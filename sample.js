/**
 * mmd.three.js
 * @version 0.91 (2014/10/13)
 * @requires three.js r58
 * @requires customized three.js's src files (override classes)
 * @requires ammo.js (bullet physics engine)
 * @requires encoding.js <a href="http://polygon-planet-log.blogspot.jp/2012/04/javascript.html">blog</a>
 * @requires misc.js
 * @author <a href="http://www20.atpages.jp/katwat/wp/">katwat</a>
 */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/.
 */

(function() {

"use strict";

var load, loadText, loadBuffer, EventMonitor, BinaryStream,

	// loader
	Exception,
	convV, convV2, convR, convR2,
	PMX, VMD,

	// builder, handler
	cubicBezier, Animation, cloneKey,
	MMDShader, MMDMaterial, MMDIK, MMDPhysi, MMDMorph, MMDSkin, MMDAddTrans, MMDCamera, MMDLight,
	Model,

	// physics
	btWorld, tmpBV, tmpBQ,
	fixedTimeStep = 1/60, //lastSimulateTime, lastSimulateDuration = 0,

	MMD;

load = Misc.load;
loadText = function( url, onload, onerror ) {
	load( url, 'text', onload, onerror );
};
loadBuffer = function( url, onload, onerror ) {
	load( url, 'arraybuffer', onload, onerror );
};
EventMonitor = Misc.EventMonitor;
BinaryStream = Misc.BinaryStream;

// left to right hand
convV = function( a ) { // position or vector
	a[2] *= -1; // inverse z
	return a;
};
convV2 = function( lower, upper ) {
	var t;
	convV( lower );
	convV( upper );
	// swap
	t = lower[2];
	lower[2] = upper[2];
	upper[2] = t;
};
convR = function( a ) { // euler rotation or quaternion
	a[0] *= -1; // inverse x
	a[1] *= -1; // inverse y
	return a;
};
convR2 = function( lower, upper ) {
	var t;
	convR( lower );
	convR( upper );
	// swap
	t = lower[0];
	lower[0] = upper[0];
	upper[0] = t;
	t = lower[1];
	lower[1] = upper[1];
	upper[1] = t;
};

Exception = {
	MAGIC: 'IllegalMagicException',
	DATA: 'IllegalDataException'
};

(function() { // PMX

var Reader, Info, Skin, Vertex, Texture, Material, IKLink, IK, Bone,
	MorphVertex, MorphUV, MorphBone, MorphMaterial, MorphGroup, Morph,
	FrameItem, Frame, Rigid, Joint,

	_bdef1, _bdef2, _bdef4, _sdef; // debug

Reader = function( buffer ) { // extend BinaryStream
	BinaryStream.call( this, buffer, true ); // this.littleEndian = true;

	// read header
	if ( this.readUint32() !== 0x20584d50 ) { //  'PMX '
		throw Exception.MAGIC;
	}
	this.version = this.readFloat32();
	if ( this.version !== 2.0 ) {
		throw Exception.DATA; // not supported
	}
	if ( this.readUint8() !== 8 ) {
		throw Exception.DATA;
	}
	this.encode = this.readUint8(); // 0=UTF16_LE, 1=UTF-8
	this.additionalUvCount = this.readUint8();
	this.vertexIndexSize = this.readUint8();
	this.textureIndexSize = this.readUint8();
	this.materialIndexSize = this.readUint8();
	this.boneIndexSize = this.readUint8();
	this.morphIndexSize = this.readUint8();
	this.rigidIndexSize = this.readUint8();
};
Reader.prototype = Object.create( BinaryStream.prototype );
Reader.prototype.constructor = Reader;

Reader.prototype.readText = function() {
	var l = this.readInt32(), a, b;
	if ( l === 0 ) {
		return '';
	}
	a = [];
	if ( this.encode === 0 ) {
		// utf16_le
		l /= 2;
		while ( l-- > 0 ) {
			a.push( this.readUint16() );
		}
	} else {
		// utf8 -> utf16
		while ( l > 0 ) {
			b = this.readUint8();
			if ( ( b & 0xf0 ) === 0xe0 ) {
				// 3 bytes
				b &= 0x0f;
				b = ( b << 6 ) | ( this.readUint8() & 0x3f );
				b = ( b << 6 ) | ( this.readUint8() & 0x3f );
				l -= 3;
			} else
			if ( ( b & 0xe0 ) === 0xc0 ) {
				// 2 bytes
				b &= 0x1f;
				b = ( b << 6 ) | ( this.readUint8() & 0x3f );
				l -= 2;
			} else {
				// 1 byte
				l--;
			}
			a.push( b );
		}
	}
	return String.fromCharCode.apply( undefined, a );
};
Reader.prototype.readIndex = function( size, vertex ) {
	var i;
	if ( size === 1 ) {
		i = vertex ? this.readUint8() : this.readInt8();
	} else
	if ( size === 2 ) {
		i = vertex ? this.readUint16() : this.readInt16();
	} else
	if ( size === 4 ) {
		i = this.readInt32();
	} else {
		throw Exception.DATA;
	}
	return i;
};
Reader.prototype.readVertexIndex = function() {
	return this.readIndex( this.vertexIndexSize, true );
};
Reader.prototype.readTextureIndex = function() {
	return this.readIndex( this.textureIndexSize );
};
Reader.prototype.readMaterialIndex = function() {
	return this.readIndex( this.materialIndexSize );
};
Reader.prototype.readBoneIndex = function() {
	return this.readIndex( this.boneIndexSize );
};
Reader.prototype.readMorphIndex = function() {
	return this.readIndex( this.morphIndexSize );
};
Reader.prototype.readRigidIndex = function() {
	return this.readIndex( this.rigidIndexSize );
};
Reader.prototype.readVector = function( n ) {
	var v = [];
	while ( n-- > 0 ) {
		v.push( this.readFloat32() );
	}
	return v;
};

Info = function( bin ) {
	this.name = bin.readText();
	this.nameEn = bin.readText();
	this.comment = bin.readText();
	this.commentEn = bin.readText();
};

Skin = function( bin ) {
	var w;
	this.type = bin.readUint8();
	switch( this.type ) {
	case 0: // BDEF1
		this.bones = [ readBoneIndex() ];
		this.weights = [ 1.0 ];
		_bdef1++; // debug
		break;
	case 1: // BDEF2
		this.bones = [ readBoneIndex(), readBoneIndex() ];
		w = bin.readFloat32();
		this.weights = [ w, 1.0 - w ];
		_bdef2++; // debug
		break;
	case 2: // BDEF4
		this.bones = [ readBoneIndex(), readBoneIndex(), readBoneIndex(), readBoneIndex() ];
		this.weights = [ bin.readFloat32(), bin.readFloat32(), bin.readFloat32(), bin.readFloat32() ];
		_bdef4++; // debug
		break;
	case 3: // SDEF
		this.bones = [ readBoneIndex(), readBoneIndex() ];
		w = bin.readFloat32();
		this.weights = [ w, 1.0 - w ];
		this.sdefC = bin.readVector( 3 );
		this.sdefR0 = bin.readVector( 3 );
		this.sdefR1 = bin.readVector( 3 );
		_sdef++; // debug
		break;
	default:
		throw Exception.DATA;
	}

	function readBoneIndex() {
		var i = bin.readBoneIndex();
		if (i < 0) { // ボーン指定無しの場合は安全のためゼロにする。当然weightはゼロのはず。
			i = 0;
		}
		return i;
	}
};

Vertex = function( bin ) {
	var n;
	this.pos = convV( bin.readVector( 3 ) );
	this.normal = convV( bin.readVector( 3 ) );
	this.uv = bin.readVector( 2 );
	this.additionalUvs = [];
	n = bin.additionalUvCount;
	while ( n-- > 0 ) {
		this.additionalUvs.push( bin.readVector( 4 ) ); // x,y,z,w
	}
	this.skin = new Skin( bin );
	this.edgeScale = bin.readFloat32();
};

Texture = function( bin ) {
	this.path = bin.readText().replace(/\\/g,'/');
};

Material = function( bin ) {
	this.name = bin.readText();
	this.nameEn = bin.readText();
	this.diffuse = bin.readVector(3);
	this.alpha = bin.readFloat32();
	this.specular = bin.readVector(3);
	this.power = bin.readFloat32();
	this.ambient = bin.readVector(3);
	this.drawFlags = bin.readUint8();
	this.edgeColor = bin.readVector(4);
	this.edgeSize = bin.readFloat32();
	this.texture = bin.readTextureIndex();
	this.sphereTexture = bin.readTextureIndex();
	this.sphereMode = bin.readUint8();
	this.sharedToon = bin.readUint8();
	if ( this.sharedToon === 0 ) {
		this.toonTexture = bin.readTextureIndex(); // -1: not apply toon
	} else {
		this.toonTexture = bin.readUint8();
	}
	this.memo = bin.readText();
	this.indexCount = bin.readInt32();

	/* // debug
	var s = this.drawFlags.toString(2);
	while ( s.length < 5 ) {
		s = '0' + s;
	}
	console.log( this.name, s ); */
};

IKLink = function( bin ) {
	this.bone = bin.readBoneIndex();
	if ( bin.readUint8() === 1 ) {
		this.limits = [ bin.readVector(3), bin.readVector(3) ];
		convR2( this.limits[0], this.limits[1] );
	}
};

IK = function( bin ) {
	var n;
	this.effector = bin.readBoneIndex();
	this.iteration = bin.readInt32();
	this.control = bin.readFloat32();
	this.links = [];
	n = bin.readInt32();
	while ( n-- > 0 ) {
		this.links.push( new IKLink( bin ) );
	}
};

Bone = function( bin ) {
	this.name = bin.readText();
	//console.log('*' + this.name);
	this.nameEn = bin.readText();
	this.origin = convV( bin.readVector(3) );
	this.parent = bin.readBoneIndex();
	this.deformHierachy = bin.readInt32();
	//console.log('deformHierachy ' + this.deformHierachy);
	this.flags = bin.readUint16();
	//console.log(this.flags.toString(16));
	if ( ( this.flags & 1 ) !== 0 ) {
		bin.readBoneIndex(); // dummy read
		//this.end = bin.readBoneIndex();
	} else {
		bin.readVector(3); // dummy read
		//this.end = convV( bin.readVector(3) );
	}
	/* if ( ( this.flags & 2 ) !== 0 ) {
		console.log('rotatable');
	}
	if ( ( this.flags & 4 ) !== 0 ) {
		console.log('translatable');
	}
	if ( ( this.flags & 8 ) !== 0 ) {
		console.log('visible');
	}
	if ( ( this.flags & 0x10 ) !== 0 ) {
		console.log('manipulatable');
	} */
	/* if ( ( this.flags & 0x80 ) !== 0 ) {
		//console.log('GlobalAdditionalTransform');
	} */
	if ( ( this.flags & 0x300) !== 0 ) {
		this.additionalTransform = [ bin.readBoneIndex(), bin.readFloat32() ];
		//console.log('additionalTransform(' + (this.flags & 0x300).toString(16) + ')', this.additionalTransform);
	}
	if ( ( this.flags & 0x400) !== 0 ) {
		bin.readVector(3); // dummy read
		//this.fixedAxis = convV( bin.readVector(3) );
		//console.log('fixedAxis ',this.fixedAxis);
	}
	if ( ( this.flags & 0x800) !== 0 ) {
		bin.readVector(3); bin.readVector(3); // dummy read
		//this.localCoordinate = [ convV( bin.readVector(3) ), convV( bin.readVector(3) ) ];
		//console.log('localCoordinate ', this.localCoordinate);
	}
	/* if ( ( this.flags & 0x1000) !== 0 ) {
		//this.afterPhysics = true;
		//console.log('afterPhysics');
	} */
	if ( ( this.flags & 0x2000) !== 0 ) {
		this.externalDeform = bin.readInt32(); // key
		//console.log('externalDeform ', this.externalDeform);
	}
	if ( ( this.flags & 0x20) !== 0 ) {
		this.IK = new IK( bin );
		//console.log('IK');
	}
};

MorphVertex = function( bin ) {
	this.target = bin.readVertexIndex();
	this.offset = convV( bin.readVector(3) );
};

MorphUV = function( bin ) {
	this.target = bin.readVertexIndex();
	this.uv = bin.readVector(4);
};

MorphBone = function( bin ) {
	this.target = bin.readBoneIndex();
	this.pos = bin.readVector(3);
	this.rot = bin.readVector(4);
};

MorphMaterial = function( bin ) {
	this.target = bin.readMaterialIndex();
	this.operator = bin.readUint8();
	this.diffuse = bin.readVector(3);
	this.alpha = bin.readFloat32();
	this.specular = bin.readVector(3);
	this.power = bin.readFloat32();
	this.ambient = bin.readVector(3);
	this.edgeColor = bin.readVector(4);
	this.edgeSize = bin.readFloat32();
	this.texture = bin.readVector(4);
	this.sphereTexture = bin.readVector(4);
	this.toonTexture = bin.readVector(4);
};

MorphGroup = function( bin ) {
	this.target = bin.readMorphIndex(); // no group nest
	this.weight = bin.readFloat32();
};

Morph = function( bin ) {
	var n;
	this.name = bin.readText();
	this.nameEn = bin.readText();
	this.panel = bin.readUint8();
	this.type = bin.readUint8();
	this.items = [];

	/* // debug
	if ( this.type === 0 ) {
		console.log(this.name + ' MorphGroup');
	} else
	if ( this.type === 1 ) {
		console.log(this.name + ' MorphVertex');
	} else
	if ( this.type === 2 ) {
		console.log(this.name + ' MorphBone');
	} else
	if ( this.type >= 3 && this.type <= 7 ) {
		console.log(this.name + ' MorphUV' + (this.type - 3));
	} else
	if ( this.type === 8 ) {
		console.log(this.name + ' MorphMaterial');
	} */

	n = bin.readInt32();
	while ( n-- > 0) {
		if ( this.type === 0 ) {
			this.items.push( new MorphGroup( bin ) );
		} else
		if ( this.type === 1 ) {
			this.items.push( new MorphVertex( bin ) );
		} else
		if ( this.type === 2 ) {
			this.items.push( new MorphBone( bin ) );
		} else
		if ( this.type >= 3 && this.type <= 7 ) {
			this.items.push( new MorphUV( bin ) );
		} else
		if ( this.type === 8 ) {
			this.items.push( new MorphMaterial( bin ) );
		} else {
			throw Exception.DATA;
		}
	}
};

FrameItem = function( bin ) {
	this.type = bin.readUint8();
	if ( this.type === 0 ) {
		this.index = bin.readBoneIndex();
	} else
	if ( this.type === 1 ) {
		this.index = bin.readMorphIndex();
	} else {
		throw Exception.DATA;
	}
};

Frame = function( bin ) {
	var n;
	this.name = bin.readText();
	this.nameEn = bin.readText();
	this.special = bin.readUint8();
	this.items = [];
	n = bin.readInt32();
	while (n-- > 0) {
		this.items.push( new FrameItem( bin ) );
	}
};

Rigid = function( bin ) { // rigid body
	this.name = bin.readText();
	this.nameEn = bin.readText();
	this.bone = bin.readBoneIndex();
	this.group = bin.readUint8();
	this.mask = bin.readUint16();
	this.shape = bin.readUint8();
	this.size = bin.readVector(3);
	this.pos = convV( bin.readVector(3) );
	this.rot = convR( bin.readVector(3) );
	this.mass = bin.readFloat32();
	this.posDamping = bin.readFloat32();
	this.rotDamping = bin.readFloat32();
	this.restitution = bin.readFloat32();
	this.friction = bin.readFloat32();
	this.type = bin.readUint8();
};

Joint = function( bin ) { // constraint between two rigid bodies
	this.name = bin.readText();
	this.nameEn = bin.readText();
	this.type = bin.readUint8();
	this.rigidA = bin.readRigidIndex();
	this.rigidB = bin.readRigidIndex();
	this.pos = convV( bin.readVector(3) );
	this.rot = convR( bin.readVector(3) );
	this.posLower = bin.readVector(3);
	this.posUpper = bin.readVector(3);
	convV2( this.posLower, this.posUpper );
	this.rotLower = bin.readVector(3);
	this.rotUpper = bin.readVector(3);
	convR2( this.rotLower, this.rotUpper );
	this.posSpring = bin.readVector(3);
	this.rotSpring = bin.readVector(3);
};

PMX = function() {
};
PMX.prototype.parse = function( buffer ) {
	var bin, n, bones;
	bin = new Reader( buffer );

	this.vertices = [];
	this.indices = [];
	this.textures = [];
	this.materials = [];
	this.bones = [];
	this.morphs = [];
	this.frames = [];
	this.rigids = [];
	this.joints = [];

	_bdef1 = _bdef2 = _bdef4 = _sdef = 0; // debug

	this.info = new Info( bin );
	console.log(this.info.name);

	n = bin.readInt32();
	console.log('vertices = ' + n);
	while ( n-- > 0 ) {
		this.vertices.push( new Vertex( bin ) );
	}
	console.log('(bdef1=' + _bdef1 + ' bdef2=' + _bdef2 +' bdef4=' + _bdef4 +' sdef=' + _sdef + ')');

	n = bin.readInt32();
	console.log('faces = ' + n/3);
	while ( n-- > 0 ) {
		this.indices.push( bin.readVertexIndex() );
	}

	n = bin.readInt32();
	console.log('textures = ' + n);
	while ( n-- > 0 ) {
		this.textures.push( new Texture( bin ) );
	}

	n = bin.readInt32();
	console.log('materials = ' + n);
	while ( n-- > 0 ) {
		this.materials.push( new Material( bin ) );
	}

	n = bin.readInt32();
	console.log('bones = ' + n);
	while ( n-- > 0 ) {
		this.bones.push( new Bone( bin ) );
	}

	n = bin.readInt32();
	console.log('morphs = ' + n);
	while ( n-- > 0 ) {
		this.morphs.push( new Morph( bin ) );
	}

	n = bin.readInt32();
	console.log('frames = ' + n);
	while ( n-- > 0 ) {
		this.frames.push( new Frame( bin ) );
	}

	n = bin.readInt32();
	console.log('rigid bodies = ' + n);
	while ( n-- > 0 ) {
		this.rigids.push( new Rigid( bin ) );
	}

	n = bin.readInt32();
	console.log('joints = ' + n);
	while ( n-- > 0 ) {
		this.joints.push( new Joint( bin ) );
	}

	// ボーンに対する剛体の位置オフセットを求める。
	bones = this.bones;
	this.rigids.forEach( function( v ) {
		var o;
		if ( v.bone >= 0 ) {
			o = bones[ v.bone ].origin;
			v.ofs = [ v.pos[0] - o[0], v.pos[1] - o[1], v.pos[2] - o[2] ];
		}
	});
};
PMX.prototype.createMesh = function( param, oncreate ) {
	var that, geo, materials, monitor, iid,
		createV, createUV, createColor, createTexture, textureDict;

	if ( !this.vertices ) {
		console.error( 'not parsed' );
		return;
	}

	that = this;

	// set default value if not defined
	if ( param.texturePath === undefined ) {
		param.texturePath = this.url ? Misc.extractPathBase(this.url) : '';
	}
	if ( param.shadowDark === undefined ) {
		param.shadowDark = 0.3;
	}
	if ( param.edgeScale === undefined ) {
		param.edgeScale = 1.0;
	}
	if ( param.textureAlias === undefined ) {
		param.textureAlias = {};
	}

	geo = new THREE.Geometry();
	materials = [];

	monitor = new EventMonitor();
	monitor.add( function() {
		oncreate( new THREE.SkinnedMesh( geo, new THREE.MeshFaceMaterial( materials ) ) );
	});

	createV = function( a ) {
		return new THREE.Vector3( a[0], a[1], a[2] );
	};
	createUV = function( a ) {
		return new THREE.Vector2( a[0], a[1] );
	};
	createColor = function( a ) {
		var c = new THREE.Color();
		c.r = a[0];
		c.g = a[1];
		c.b = a[2];
		return c;
	};
	textureDict = {};
	createTexture = function( fname ) {
		var ext, p, texture, onerror;

		// alias
		ext = Misc.extractPathExt( fname ).toLowerCase();
		for ( p in param.textureAlias ) {
			if ( p === ext ) {
				// replace ext
				ext = param.textureAlias[ p ];
				fname = fname.slice( 0, -(p.length) ) + ext;
				break;
			}
		}

		// cache
		if ( textureDict.hasOwnProperty( fname ) ) {
			return textureDict[fname];
		}

		// load
		onerror = function() {
			monitor.del();
			//console.error( fname + ' load failed' );
			alert( fname + ' load failed' );
		};
		monitor.add();
		if ( ext === 'dds' ) {
			texture = THREE.ImageUtils.loadCompressedTexture( param.texturePath + fname, undefined,
				function( texture ) {
					// !!! format is DXT1 or DXT3 or DXT5 !!!
					texture.hasTransparency = ( texture.format !== THREE.RGB_S3TC_DXT1_Format );
					texture.minFilter = texture.magFilter = THREE.LinearFilter;
					monitor.del();
				},
				onerror);
		} else {
			texture = THREE.ImageUtils.loadTexture( param.texturePath + fname, undefined,
				function( /* texture */ ) {
					monitor.del();
				},
				onerror);
		}
		texture.flipY = false; // DDSには flipY=true が効かないのでfalseにする。上下逆貼りに注意。
		texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
		textureDict[fname] = texture;
		return texture;
	};
	// vertex, skin
	this.vertices.forEach( function( v ) {
		var skin;

		// vertex
		geo.vertices.push( createV( v.pos ) );

		// skin
		skin = v.skin;
		switch ( skin.type ) {
		case 0: // BDEF1
			geo.skinWeights.push( new THREE.Vector4( skin.weights[0], 0, 0, 0 ) );
			geo.skinIndices.push( new THREE.Vector4( skin.bones[0], 0, 0, 0 ) );
			break;
		case 1: // BDEF2
		case 3: // SDEF
			geo.skinWeights.push( new THREE.Vector4( skin.weights[0], skin.weights[1], 0, 0 ) );
			geo.skinIndices.push( new THREE.Vector4( skin.bones[0], skin.bones[1], 0, 0 ) );
			break;
		case 2: // BDEF4
			geo.skinWeights.push( new THREE.Vector4( skin.weights[0], skin.weights[1], skin.weights[2], skin.weights[3] ) );
			geo.skinIndices.push( new THREE.Vector4( skin.bones[0], skin.bones[1], skin.bones[2], skin.bones[3] ) );
			break;
		}
	});
	geo.MMDmorphs = this.morphs;

	// material, face
	iid = 0;
	geo.faceVertexUvs[ 0 ] = []; // uv layer #0
	this.materials.forEach( function( v, idx ) {
		var p, face, n, a, b, c, va, vb, vc;

		// material
		p = new MMDMaterial();
		p.lights = true; // use scene light
		p.skinning = true; // use bone skinning
		p.ambient = createColor( v.ambient );
		p.color = createColor( v.diffuse );
		p.specular = createColor( v.specular );
		p.shininess = v.power;
		p.opacity = v.alpha;
		p.transparent = true; // 問題回避のために描画順は全て「奥から手前」にする。
		if ( ( v.drawFlags & 0x01 ) !== 0 ) {
			p.side = THREE.DoubleSide;
		}
		if ( ( v.drawFlags & 0x02 ) !== 0 ) {
			// 地面影。
			p.castShadow = true;
			p.shadowMapCullFace = THREE.CullFaceNone; // == gl.disable( gl.CULL_FACE )
			//p.shadowMapCullFace = THREE.CullFaceFront;
			//p.shadowMapCullFace = THREE.CullFaceBack;
		} else {
			p.castShadow = false;
		}
		if ( ( v.drawFlags & 0x08 ) !== 0 ) {
			// セルフシャドウ描画。
			p.mmdShadowDark = param.shadowDark;
		}
		if ( ( v.drawFlags & 0x10 ) !== 0 ) {
			// エッジ描画。
			p.mmdEdgeThick = v.edgeSize * param.edgeScale;
			p.mmdEdgeColor = new THREE.Vector4( v.edgeColor[0], v.edgeColor[1], v.edgeColor[2], v.edgeColor[3] ); // rgba
		}
		if ( v.texture >= 0 ) {
			p.map = createTexture( that.textures[ v.texture ].path );
		}
		a = null;
		if (v.sharedToon === 0) {
			if (v.toonTexture >= 0) {
				a = that.textures[ v.toonTexture ].path;
			}
		} else {
			a = 'toon' + [ '01','02','03','04','05','06','07','08','09','10' ][ v.toonTexture ] + '.bmp';
		}
		if (a) {
			p.mmdToonMap = createTexture( a );
		}
		if ( v.sphereMode > 0 && v.sphereTexture >= 0 ) {
			p.mmdSphereMode = v.sphereMode;
			p.mmdSphereMap = createTexture( that.textures[ v.sphereTexture ].path );
		}
		p.setup();
		materials.push( p );

		// face
		n = v.indexCount / 3; // triangles
		while ( n-- ) {
			// lett to right hand order
			a = that.indices[ iid + 2 ];
			b = that.indices[ iid + 1 ];
			c = that.indices[ iid     ];
			face = new THREE.Face3( a, b, c );
			face.materialIndex = idx;
			va = that.vertices[ a ];
			vb = that.vertices[ b ];
			vc = that.vertices[ c ];
			geo.faceVertexUvs[0].push( v.texture >= 0 ? [ createUV( va.uv ), createUV( vb.uv ), createUV( vc.uv ) ] : undefined );
			face.vertexNormals = [ createV( va.normal ), createV( vb.normal ), createV( vc.normal ) ];
			geo.faces.push( face );
			iid += 3;
		}
	});

	// bone, ik
	geo.MMDIKs = [];
	geo.bones = [];
	this.bones.forEach( function( v, idx ) {
		var pos, bone;
		if ( v.IK ) {
			v.IK.target = idx;
			geo.MMDIKs.push( v.IK );
		}
		if ( v.parent >= 0 ) {
			// relative position from parent
			pos = that.bones[ v.parent ].origin;
			pos = [ v.origin[0] - pos[0], v.origin[1] - pos[1], v.origin[2] - pos[2] ];
		} else {
			pos = v.origin;
		}
		bone = {};
		bone.parent = v.parent;
		bone.name = v.name;
		bone.pos = pos;
		bone.rotq = [ 0, 0, 0, 1 ];
		geo.bones.push( bone );
	});

	// rigid body, joint
	geo.MMDrigids = this.rigids;
	geo.MMDjoints = this.joints;

	// bounding box & sphere
	geo.computeBoundingBox();
	geo.boundingSphere = geo.boundingBox.getBoundingSphere();

	// done
	monitor.del();
};
PMX.prototype.load = function( url, onload ) {
	var that = this;
	loadBuffer( url, function( xhr ) {
		that.url = url;
		that.parse( xhr.response );
		onload( that );
	});
};

}()); // PMX

cloneKey = function( k ) {
	var o, p;
	o = {};
	for ( p in k ) {
		if ( k.hasOwnProperty( p ) ) {
			o[p] = k[p]; // shallow copy
		}
	}
	return o;
};

(function() { // VMD

var f2t, sortKeys, MAGIC, Reader, BoneKey, MorphKey, CameraKey, LightKey;

f2t = function( f ) { // frame number to time
	return f/30; // 30 fps
};

sortKeys = function( keys ) {
	keys.sort( function( a, b ) {
		return a.time - b.time;
	});
};

MAGIC = [0x56,0x6F,0x63,0x61,0x6C,0x6F,0x69,0x64,0x20,0x4D,0x6F,0x74,0x69,0x6F,0x6E,0x20,0x44,0x61,0x74,0x61,0x20,0x30,0x30,0x30,0x32]; // 'Vocaloid Motion Data 0002'

Reader = function( buffer ) { // extend BinaryStream
	var b, i;
	BinaryStream.call( this, buffer, true ); //this.littleEndian = true;
	this.stringMap = {};

	// read header
	b = this.readBytes( 30 );
	for ( i=0; i<MAGIC.length; i++ ) {
		if ( MAGIC[i] !== b[i] ) {
			throw Exception.MAGIC;
		}
	}
	this.name = this.readCString( 20 );
};
Reader.prototype = Object.create( BinaryStream.prototype );
Reader.prototype.constructor = Reader;

Reader.prototype.readCString = function( length ) {
	var b, i, text;
	b = this.readBytes( length );
	for ( i=0; i<length; i++ ) {
		if ( b[i] === 0 ) {
			break;
		}
	}
	text = String.fromCharCode.apply( undefined, Encoding.convert( b.subarray( 0, i ), 'UNICODE', 'SJIS') );

	// reduce string instance
	if ( this.stringMap.hasOwnProperty( text ) ) {
		text = this.stringMap[ text ];
	} else {
		this.stringMap[ text ] = text;
	}
	return text;
};
Reader.prototype.readVector = function( n ) {
	var v = [];
	while ( n-- > 0 ) {
		v.push( this.readFloat32() );
	}
	return v;
};

BoneKey = function( bin ) {
	this.name = bin.readCString(15);
	this.time = f2t( bin.readUint32() );
	this.pos = convV( bin.readVector(3) );
	this.rot = convR( bin.readVector(4) );
	this.interp = bin.readBytes(64).subarray(0,16); // 必要なのは最初の１６個。
};

MorphKey = function( bin ) {
	this.name = bin.readCString(15);
	this.time = f2t( bin.readUint32() );
	this.weight = bin.readFloat32();
};

CameraKey = function( bin ) {
	// 扱いやすいように一部の値は符号反転しておく。
	this.time = f2t( bin.readUint32() );
	this.distance = -bin.readFloat32();
	this.target = convV( bin.readVector(3) );
	this.rot = convR( bin.readVector(3) );
	this.rot[0] *= -1;
	this.rot[1] *= -1;
	this.rot[2] *= -1;
	this.interp = bin.readBytes(24);
	this.fov = bin.readUint32();
	this.ortho = bin.readInt8();
};

LightKey = function( bin ) {
	this.time = f2t( bin.readUint32() );
	this.color = bin.readVector(3);
	this.dir = convV( bin.readVector(3) );
};

VMD = function() {
};
VMD.prototype.parse = function( buffer ) {
	var bin, n;

	bin = new Reader( buffer );

	this.timeMax = 0;
	this.boneKeys = [];
	this.morphKeys = [];
	this.cameraKeys = [];
	this.lightKeys = [];

	n = bin.readUint32();
	while ( n-- > 0 ) {
		this.boneKeys.push( new BoneKey( bin ) );
	}
	sortKeys( this.boneKeys );
	n = this.boneKeys.length;
	if ( n > 0 ) {
		// last key
		this.timeMax = Math.max( this.timeMax, this.boneKeys[ n-1 ].time );
	}

	n = bin.readUint32();
	while ( n-- > 0 ) {
		this.morphKeys.push( new MorphKey( bin ) );
	}
	sortKeys( this.morphKeys );
	n = this.morphKeys.length;
	if ( n > 0 ) {
		// last key
		this.timeMax = Math.max( this.timeMax, this.morphKeys[ n-1 ].time );
	}

	n = bin.readUint32();
	while ( n-- > 0 ) {
		this.cameraKeys.push( new CameraKey( bin ) );
	}
	sortKeys( this.cameraKeys );
	n = this.cameraKeys.length;
	if ( n > 0 ) {
		// last key
		this.timeMax = Math.max( this.timeMax, this.cameraKeys[ n-1 ].time );
	}

	n = bin.readUint32();
	while ( n-- > 0 ) {
		this.lightKeys.push( new LightKey( bin ) );
	}
	sortKeys( this.lightKeys );
	n = this.lightKeys.length;
	if ( n > 0 ) {
		// last key
		this.timeMax = Math.max( this.timeMax, this.lightKeys[ n-1 ].time );
	}

	// done
	delete bin.stringMap;
};
VMD.prototype.load = function( url, onload ) {
	var that = this;
	loadBuffer( url, function( xhr ) {
		that.url = url;
		that.parse( xhr.response );
		onload( that );
	});
};
VMD.prototype.generateSkinAnimation = function( pmx ) {
	var boneKeys, timeMax, targets;
	boneKeys = this.boneKeys;
	if ( boneKeys.length === 0 ) {
		return null;
	}
	timeMax = this.timeMax;
	targets = [];
	pmx.bones.forEach( function( v ) {
		var keys, last;
		// 一連のキーをターゲット（名前）毎に振り分ける。
		keys = [];
		boneKeys.forEach( function( w ) {
			if ( v.name === w.name ) {
				last = w;
				keys.push( w );
			}
		});
		if ( last && last.time < timeMax ) {
			last = cloneKey( last );
			last.time = timeMax;
			keys.push( last );
		}
		targets.push( { keys:keys } );
	});
	return { duration:timeMax, targets:targets };
};
VMD.prototype.generateMorphAnimation = function( pmx ) {
	var morphKeys, timeMax, targets;
	morphKeys = this.morphKeys;
	if ( morphKeys.length === 0 ) {
		return null;
	}
	timeMax = this.timeMax;
	targets = [];
	pmx.morphs.forEach( function( v ) {
		var keys, last;
		if ( v.type === 1 ) { // vertex
			// 一連のキーをターゲット（名前）毎に振り分ける。
			keys = [];
			morphKeys.forEach( function( w ) {
				if ( v.name === w.name ) {
					last = w;
					keys.push( w );
				}
			});
			if ( keys.length === 1 && last.weight === 0 ) {
				// omit
				keys = [];
				last = undefined;
			}
			if ( !last ) {
				return;
			}
			if ( /* last && */ last.time < timeMax ) {
				last = cloneKey( last );
				last.time = timeMax;
				keys.push( last );
			}
			targets.push( { keys:keys } );
		}
	});
	if ( targets.length === 0 ) {
		return null;
	}
	return { duration:timeMax, targets:targets };
};
VMD.prototype.generateCameraAnimation = function() {
	var cameraKeys, timeMax, keys, last;
	cameraKeys = this.cameraKeys;
	if ( cameraKeys.length === 0 ){
		return null;
	}
	timeMax = this.timeMax;
	keys = [];
	cameraKeys.forEach( function( v ) {
		last = v;
		keys.push( v );
	});
	if ( last && last.time < timeMax ) {
		last = cloneKey( last );
		last.time = timeMax;
		keys.push( last );
	}
	return { duration:timeMax, keys:keys };
};
VMD.prototype.generateLightAnimation = function() {
	var lightKeys, timeMax, keys, last;
	lightKeys = this.lightKeys;
	if ( lightKeys.length === 0 ){
		return null;
	}
	timeMax = this.timeMax;
	keys = [];
	lightKeys.forEach( function( v ) {
		last = v;
		keys.push( v );
	});
	if ( last && last.time < timeMax ) {
		last = cloneKey( last );
		last.time = timeMax;
		keys.push( last );
	}
	return { duration:timeMax, keys:keys };
};

}()); // VMD

MMDShader = { // MOD MeshPhongMaterial
	uniforms: THREE.UniformsUtils.merge( [
		THREE.UniformsLib.common,
		THREE.UniformsLib.bump,
		THREE.UniformsLib.normalmap,
		THREE.UniformsLib.fog,
		THREE.UniformsLib.lights,
		THREE.UniformsLib.shadowmap,
		{
			"ambient"  : { type: "c", value: new THREE.Color( 0xffffff ) },
			"emissive" : { type: "c", value: new THREE.Color( 0x000000 ) },
			"specular" : { type: "c", value: new THREE.Color( 0x111111 ) },
			"shininess": { type: "f", value: 30 },
			"wrapRGB"  : { type: "v3", value: new THREE.Vector3( 1, 1, 1 ) },

			// MMD
			"mmdToonMap"   : { type: "t", value: null },
			"mmdSphereMap" : { type: "t", value: null },
			"mmdEdgeThick" : { type: "f", value: 0 },
			"mmdEdgeColor" : { type: "v4", value: new THREE.Vector4( 0, 0, 0, 1 ) }, // RGBA
			"mmdShadowDark": { type: "f", value: 0 }
		}
	] ),
	vertexShader: '#define MMD\n#define PHONG\nvarying vec3 vViewPosition;varying vec3 vNormal;\n#if defined( USE_MAP ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( USE_SPECULARMAP )\nvarying vec2 vUv;uniform vec4 offsetRepeat;\n#endif\n#ifdef USE_LIGHTMAP\nvarying vec2 vUv2;\n#endif\n#if defined( USE_ENVMAP ) && ! defined( USE_BUMPMAP ) && ! defined( USE_NORMALMAP )\nvarying vec3 vReflect;uniform float refractionRatio;uniform bool useRefract;\n#endif\n#ifndef PHONG_PER_PIXEL\n#if MAX_POINT_LIGHTS > 0\nuniform vec3 pointLightPosition[ MAX_POINT_LIGHTS ];uniform float pointLightDistance[ MAX_POINT_LIGHTS ];varying vec4 vPointLight[ MAX_POINT_LIGHTS ];\n#endif\n#if MAX_SPOT_LIGHTS > 0\nuniform vec3 spotLightPosition[ MAX_SPOT_LIGHTS ];uniform float spotLightDistance[ MAX_SPOT_LIGHTS ];varying vec4 vSpotLight[ MAX_SPOT_LIGHTS ];\n#endif\n#endif\n#if MAX_SPOT_LIGHTS > 0 || defined( USE_BUMPMAP )\nvarying vec3 vWorldPosition;\n#endif\n#ifdef USE_COLOR\nvarying vec3 vColor;\n#endif\n#ifdef USE_MORPHTARGETS\n#ifndef USE_MORPHNORMALS\nuniform float morphTargetInfluences[ 8 ];\n#else\nuniform float morphTargetInfluences[ 4 ];\n#endif\n#endif\n#ifdef USE_SKINNING\n#ifdef BONE_TEXTURE\nuniform sampler2D boneTexture;mat4 getBoneMatrix( const in float i ) {float j = i * 4.0;float x = mod( j, N_BONE_PIXEL_X );float y = floor( j / N_BONE_PIXEL_X );const float dx = 1.0 / N_BONE_PIXEL_X;const float dy = 1.0 / N_BONE_PIXEL_Y;y = dy * ( y + 0.5 );vec4 v1 = texture2D( boneTexture, vec2( dx * ( x + 0.5 ), y ) );vec4 v2 = texture2D( boneTexture, vec2( dx * ( x + 1.5 ), y ) );vec4 v3 = texture2D( boneTexture, vec2( dx * ( x + 2.5 ), y ) );vec4 v4 = texture2D( boneTexture, vec2( dx * ( x + 3.5 ), y ) );mat4 bone = mat4( v1, v2, v3, v4 );return bone;}\n#else\nuniform mat4 boneGlobalMatrices[ MAX_BONES ];mat4 getBoneMatrix( const in float i ) {mat4 bone = boneGlobalMatrices[ int(i) ];return bone;}\n#endif\n#endif\n#ifdef USE_SHADOWMAP\nvarying vec4 vShadowCoord[ MAX_SHADOWS ];uniform mat4 shadowMatrix[ MAX_SHADOWS ];\n#endif\n#ifdef MMD\nuniform float mmdEdgeThick;\n#endif\n#ifdef MMD_SPHEREMAP\nvarying vec2 vUvSphere;\n#endif\nvoid main() {\n#ifdef USE_SKINNING\nmat4 skinMatrix;\n#ifdef MMD\nskinMatrix  = skinWeight.x * getBoneMatrix( skinIndex.x );if ( skinWeight.y > 0.0 ) {skinMatrix += skinWeight.y * getBoneMatrix( skinIndex.y );if ( skinWeight.z > 0.0 ) {skinMatrix += skinWeight.z * getBoneMatrix( skinIndex.z );skinMatrix += skinWeight.w * getBoneMatrix( skinIndex.w );}}\n#else\nskinMatrix =skinWeight.x * getBoneMatrix( skinIndex.x ) +skinWeight.y * getBoneMatrix( skinIndex.y );\n#endif\n#endif\nvec3 objectNormal = normal;\n#ifdef USE_MORPHNORMALS\nobjectNormal += ( morphNormal0 - normal ) * morphTargetInfluences[ 0 ];objectNormal += ( morphNormal1 - normal ) * morphTargetInfluences[ 1 ];objectNormal += ( morphNormal2 - normal ) * morphTargetInfluences[ 2 ];objectNormal += ( morphNormal3 - normal ) * morphTargetInfluences[ 3 ];\n#endif\n#ifdef USE_SKINNING\nobjectNormal.xyz = ( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;\n#endif\n#ifdef FLIP_SIDED\nobjectNormal = -objectNormal;\n#endif\nvNormal = normalize( normalMatrix * objectNormal );vec3 objectPosition = position;\n#ifdef USE_MORPHTARGETS\nobjectPosition += ( morphTarget0 - position ) * morphTargetInfluences[ 0 ];objectPosition += ( morphTarget1 - position ) * morphTargetInfluences[ 1 ];objectPosition += ( morphTarget2 - position ) * morphTargetInfluences[ 2 ];objectPosition += ( morphTarget3 - position ) * morphTargetInfluences[ 3 ];\n#ifndef USE_MORPHNORMALS\nobjectPosition += ( morphTarget4 - position ) * morphTargetInfluences[ 4 ];objectPosition += ( morphTarget5 - position ) * morphTargetInfluences[ 5 ];objectPosition += ( morphTarget6 - position ) * morphTargetInfluences[ 6 ];objectPosition += ( morphTarget7 - position ) * morphTargetInfluences[ 7 ];\n#endif\n#endif\n#ifdef USE_SKINNING\nobjectPosition.xyz = ( skinMatrix * vec4( objectPosition, 1.0 ) ).xyz;\n#endif\nvec4 mvPosition = modelViewMatrix * vec4( objectPosition, 1.0 );gl_Position = projectionMatrix * mvPosition;\n#ifdef MMD\nif (mmdEdgeThick > 0.0) {vec2 offset;offset.x = vNormal.x * projectionMatrix[0][0] / projectionMatrix[1][1];offset.y = vNormal.y;gl_Position.xy += offset * gl_Position.w * mmdEdgeThick;return;}\n#endif\nvViewPosition = -mvPosition.xyz;\n#if defined( USE_ENVMAP ) || defined( PHONG ) || defined( LAMBERT ) || defined ( USE_SHADOWMAP )\nvec4 worldPosition = modelMatrix * vec4( objectPosition, 1.0 );\n#endif\n#if defined( USE_ENVMAP ) && ! defined( USE_BUMPMAP ) && ! defined( USE_NORMALMAP )\nvec3 worldNormal = mat3( modelMatrix[ 0 ].xyz, modelMatrix[ 1 ].xyz, modelMatrix[ 2 ].xyz ) * objectNormal;worldNormal = normalize( worldNormal );vec3 cameraToVertex = normalize( worldPosition.xyz - cameraPosition );if ( useRefract ) {vReflect = refract( cameraToVertex, worldNormal, refractionRatio );} else {vReflect = reflect( cameraToVertex, worldNormal );}\n#endif\n#ifndef PHONG_PER_PIXEL\n#if MAX_POINT_LIGHTS > 0\nfor( int i = 0; i < MAX_POINT_LIGHTS; i ++ ) {vec4 lPosition = viewMatrix * vec4( pointLightPosition[ i ], 1.0 );vec3 lVector = lPosition.xyz - mvPosition.xyz;float lDistance = 1.0;if ( pointLightDistance[ i ] > 0.0 )lDistance = 1.0 - min( ( length( lVector ) / pointLightDistance[ i ] ), 1.0 );vPointLight[ i ] = vec4( lVector, lDistance );}\n#endif\n#if MAX_SPOT_LIGHTS > 0\nfor( int i = 0; i < MAX_SPOT_LIGHTS; i ++ ) {vec4 lPosition = viewMatrix * vec4( spotLightPosition[ i ], 1.0 );vec3 lVector = lPosition.xyz - mvPosition.xyz;float lDistance = 1.0;if ( spotLightDistance[ i ] > 0.0 )lDistance = 1.0 - min( ( length( lVector ) / spotLightDistance[ i ] ), 1.0 );vSpotLight[ i ] = vec4( lVector, lDistance );}\n#endif\n#endif\n#if MAX_SPOT_LIGHTS > 0 || defined( USE_BUMPMAP )\nvWorldPosition = worldPosition.xyz;\n#endif\n#ifdef USE_SHADOWMAP\nfor( int i = 0; i < MAX_SHADOWS; i ++ ) {vShadowCoord[ i ] = shadowMatrix[ i ] * worldPosition;}\n#endif\n#if defined( USE_MAP ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( USE_SPECULARMAP )\nvUv = uv * offsetRepeat.zw + offsetRepeat.xy;\n#endif\n#ifdef USE_LIGHTMAP\nvUv2 = uv2;\n#endif\n#ifdef MMD_SPHEREMAP\nvUvSphere = vNormal.xy * 0.5 + 0.5;vUvSphere.y = 1.0 - vUvSphere.y;\n#endif\n#ifdef USE_COLOR\n#ifdef GAMMA_INPUT\nvColor = color * color;\n#else\nvColor = color;\n#endif\n#endif\n}',
	fragmentShader: '#define MMD\nuniform vec3 diffuse;uniform float opacity;uniform vec3 ambient;uniform vec3 emissive;uniform vec3 specular;uniform float shininess;\n#ifdef USE_COLOR\nvarying vec3 vColor;\n#endif\n#if defined( USE_MAP ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( USE_SPECULARMAP )\nvarying vec2 vUv;\n#endif\n#ifdef USE_MAP\nuniform sampler2D map;\n#endif\n#ifdef USE_LIGHTMAP\nvarying vec2 vUv2;uniform sampler2D lightMap;\n#endif\n#ifdef USE_ENVMAP\nuniform float reflectivity;uniform samplerCube envMap;uniform float flipEnvMap;uniform int combine;\n#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP )\nuniform bool useRefract;uniform float refractionRatio;\n#else\nvarying vec3 vReflect;\n#endif\n#endif\n#ifdef USE_FOG\nuniform vec3 fogColor;\n#ifdef FOG_EXP2\nuniform float fogDensity;\n#else\nuniform float fogNear;uniform float fogFar;\n#endif\n#endif\nuniform vec3 ambientLightColor;\n#if MAX_DIR_LIGHTS > 0\nuniform vec3 directionalLightColor[ MAX_DIR_LIGHTS ];uniform vec3 directionalLightDirection[ MAX_DIR_LIGHTS ];\n#endif\n#if MAX_HEMI_LIGHTS > 0\nuniform vec3 hemisphereLightSkyColor[ MAX_HEMI_LIGHTS ];uniform vec3 hemisphereLightGroundColor[ MAX_HEMI_LIGHTS ];uniform vec3 hemisphereLightDirection[ MAX_HEMI_LIGHTS ];\n#endif\n#if MAX_POINT_LIGHTS > 0\nuniform vec3 pointLightColor[ MAX_POINT_LIGHTS ];\n#ifdef PHONG_PER_PIXEL\nuniform vec3 pointLightPosition[ MAX_POINT_LIGHTS ];uniform float pointLightDistance[ MAX_POINT_LIGHTS ];\n#else\nvarying vec4 vPointLight[ MAX_POINT_LIGHTS ];\n#endif\n#endif\n#if MAX_SPOT_LIGHTS > 0\nuniform vec3 spotLightColor[ MAX_SPOT_LIGHTS ];uniform vec3 spotLightPosition[ MAX_SPOT_LIGHTS ];uniform vec3 spotLightDirection[ MAX_SPOT_LIGHTS ];uniform float spotLightAngleCos[ MAX_SPOT_LIGHTS ];uniform float spotLightExponent[ MAX_SPOT_LIGHTS ];\n#ifdef PHONG_PER_PIXEL\nuniform float spotLightDistance[ MAX_SPOT_LIGHTS ];\n#else\nvarying vec4 vSpotLight[ MAX_SPOT_LIGHTS ];\n#endif\n#endif\n#if MAX_SPOT_LIGHTS > 0 || defined( USE_BUMPMAP )\nvarying vec3 vWorldPosition;\n#endif\n#ifdef WRAP_AROUND\nuniform vec3 wrapRGB;\n#endif\nvarying vec3 vViewPosition;varying vec3 vNormal;\n#ifdef USE_SHADOWMAP\nuniform sampler2D shadowMap[ MAX_SHADOWS ];uniform vec2 shadowMapSize[ MAX_SHADOWS ];uniform float shadowDarkness[ MAX_SHADOWS ];uniform float shadowBias[ MAX_SHADOWS ];varying vec4 vShadowCoord[ MAX_SHADOWS ];float unpackDepth( const in vec4 rgba_depth ) {const vec4 bit_shift = vec4( 1.0 / ( 256.0 * 256.0 * 256.0 ), 1.0 / ( 256.0 * 256.0 ), 1.0 / 256.0, 1.0 );float depth = dot( rgba_depth, bit_shift );return depth;}\n#endif\n#ifdef USE_BUMPMAP\nuniform sampler2D bumpMap;uniform float bumpScale;vec2 dHdxy_fwd() {vec2 dSTdx = dFdx( vUv );vec2 dSTdy = dFdy( vUv );float Hll = bumpScale * texture2D( bumpMap, vUv ).x;float dBx = bumpScale * texture2D( bumpMap, vUv + dSTdx ).x - Hll;float dBy = bumpScale * texture2D( bumpMap, vUv + dSTdy ).x - Hll;return vec2( dBx, dBy );}vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy ) {vec3 vSigmaX = dFdx( surf_pos );vec3 vSigmaY = dFdy( surf_pos );vec3 vN = surf_norm;vec3 R1 = cross( vSigmaY, vN );vec3 R2 = cross( vN, vSigmaX );float fDet = dot( vSigmaX, R1 );vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );return normalize( abs( fDet ) * surf_norm - vGrad );}\n#endif\n#ifdef USE_NORMALMAP\nuniform sampler2D normalMap;uniform vec2 normalScale;vec3 perturbNormal2Arb( vec3 eye_pos, vec3 surf_norm ) {vec3 q0 = dFdx( eye_pos.xyz );vec3 q1 = dFdy( eye_pos.xyz );vec2 st0 = dFdx( vUv.st );vec2 st1 = dFdy( vUv.st );vec3 S = normalize(  q0 * st1.t - q1 * st0.t );vec3 T = normalize( -q0 * st1.s + q1 * st0.s );vec3 N = normalize( surf_norm );vec3 mapN = texture2D( normalMap, vUv ).xyz * 2.0 - 1.0;mapN.xy = normalScale * mapN.xy;mat3 tsn = mat3( S, T, N );return normalize( tsn * mapN );}\n#endif\n#ifdef USE_SPECULARMAP\nuniform sampler2D specularMap;\n#endif\n#ifdef MMD\nuniform float mmdEdgeThick;uniform vec4 mmdEdgeColor;uniform float mmdShadowDark;\n#endif\n#ifdef MMD_TOONMAP\nuniform sampler2D mmdToonMap;\n#endif\n#ifdef MMD_SPHEREMAP\nvarying vec2 vUvSphere;uniform sampler2D mmdSphereMap;\n#endif\nvoid main() {\n#ifdef MMD\nif (mmdEdgeThick > 0.0) {gl_FragColor = mmdEdgeColor;} else {\n#endif\ngl_FragColor = vec4( vec3 ( 1.0 ), opacity );vec4 texelColor;\n#ifdef USE_MAP\ntexelColor = texture2D( map, vUv );\n#ifdef GAMMA_INPUT\ntexelColor.xyz *= texelColor.xyz;\n#endif\ngl_FragColor = gl_FragColor * texelColor;\n#endif\n#ifdef MMD_SPHEREMAP\ntexelColor = texture2D( mmdSphereMap, vUvSphere );\n#ifdef GAMMA_INPUT\ntexelColor.xyz *= texelColor.xyz;\n#endif\n#if MMD_SPHEREMAP == 1\ngl_FragColor = gl_FragColor * texelColor;\n#else\ngl_FragColor.xyz = gl_FragColor.xyz + texelColor.xyz;\n#endif\n#endif\n#ifdef ALPHATEST\nif ( gl_FragColor.a < ALPHATEST ) discard;\n#endif\n#ifdef MMD_TOONMAP\nfloat specularStrength;\n#ifdef USE_SPECULARMAP\nvec4 texelSpecular = texture2D( specularMap, vUv );specularStrength = texelSpecular.r;\n#else\nspecularStrength = 1.0;\n#endif\nvec3 normal = vNormal;vec3 viewPosition = normalize( vViewPosition );\n#ifdef DOUBLE_SIDED\nnormal = normal * ( -1.0 + 2.0 * float( gl_FrontFacing ) );\n#endif\n#ifdef USE_NORMALMAP\nnormal = perturbNormal2Arb( -vViewPosition, normal );\n#elif defined( USE_BUMPMAP )\nnormal = perturbNormalArb( -vViewPosition, normal, dHdxy_fwd() );\n#endif\nvec3 totalDiffuse = vec3( 0.0 );vec3 totalSpecular = vec3( 0.0 );\n#ifdef MMD_TOONMAP\nvec3 totalToon = vec3( 0.0 );\n#endif\n#if MAX_POINT_LIGHTS > 0\nfor ( int i = 0; i < MAX_POINT_LIGHTS; i ++ ) {\n#ifdef PHONG_PER_PIXEL\nvec4 lPosition = viewMatrix * vec4( pointLightPosition[ i ], 1.0 );vec3 lVector = lPosition.xyz + vViewPosition.xyz;float lDistance = 1.0;if ( pointLightDistance[ i ] > 0.0 )lDistance = 1.0 - min( ( length( lVector ) / pointLightDistance[ i ] ), 1.0 );lVector = normalize( lVector );\n#else\nvec3 lVector = normalize( vPointLight[ i ].xyz );float lDistance = vPointLight[ i ].w;\n#endif\nfloat dotProduct = dot( normal, lVector );\n#ifdef WRAP_AROUND\nfloat pointDiffuseWeightFull = max( dotProduct, 0.0 );float pointDiffuseWeightHalf = max( 0.5 * dotProduct + 0.5, 0.0 );vec3 pointDiffuseWeight = mix( vec3 ( pointDiffuseWeightFull ), vec3( pointDiffuseWeightHalf ), wrapRGB );\n#else\nfloat pointDiffuseWeight = max( dotProduct, 0.0 );\n#endif\n#ifdef MMD_TOONMAP\ntotalToon += texture2D( mmdToonMap, vec2( 0.0, 1.0 - ( 0.5 * dotProduct + 0.5 ) ) ).xyz;totalDiffuse  += diffuse * pointLightColor[ i ] * lDistance;\n#else\ntotalDiffuse  += diffuse * pointLightColor[ i ] * pointDiffuseWeight * lDistance;\n#endif\nvec3 pointHalfVector = normalize( lVector + viewPosition );float pointDotNormalHalf = max( dot( normal, pointHalfVector ), 0.0 );float pointSpecularWeight = specularStrength * pow( pointDotNormalHalf, shininess );\n#ifdef PHYSICALLY_BASED_SHADING\nfloat specularNormalization = ( shininess + 2.0001 ) / 8.0;vec3 schlick = specular + vec3( 1.0 - specular ) * pow( 1.0 - dot( lVector, pointHalfVector ), 5.0 );totalSpecular += schlick * pointLightColor[ i ] * pointSpecularWeight * pointDiffuseWeight * lDistance * specularNormalization;\n#else\ntotalSpecular += specular * pointLightColor[ i ] * pointSpecularWeight * pointDiffuseWeight * lDistance;\n#endif\n}\n#endif\n#if MAX_SPOT_LIGHTS > 0\nfor ( int i = 0; i < MAX_SPOT_LIGHTS; i ++ ) {\n#ifdef PHONG_PER_PIXEL\nvec4 lPosition = viewMatrix * vec4( spotLightPosition[ i ], 1.0 );vec3 lVector = lPosition.xyz + vViewPosition.xyz;float lDistance = 1.0;if ( spotLightDistance[ i ] > 0.0 )lDistance = 1.0 - min( ( length( lVector ) / spotLightDistance[ i ] ), 1.0 );lVector = normalize( lVector );\n#else\nvec3 lVector = normalize( vSpotLight[ i ].xyz );float lDistance = vSpotLight[ i ].w;\n#endif\nfloat spotEffect = dot( spotLightDirection[ i ], normalize( spotLightPosition[ i ] - vWorldPosition ) );if ( spotEffect > spotLightAngleCos[ i ] ) {spotEffect = max( pow( spotEffect, spotLightExponent[ i ] ), 0.0 );float dotProduct = dot( normal, lVector );\n#ifdef WRAP_AROUND\nfloat spotDiffuseWeightFull = max( dotProduct, 0.0 );float spotDiffuseWeightHalf = max( 0.5 * dotProduct + 0.5, 0.0 );vec3 spotDiffuseWeight = mix( vec3 ( spotDiffuseWeightFull ), vec3( spotDiffuseWeightHalf ), wrapRGB );\n#else\nfloat spotDiffuseWeight = max( dotProduct, 0.0 );\n#endif\n#ifdef MMD_TOONMAP\ntotalToon += texture2D( mmdToonMap, vec2( 0.0, 1.0 - ( 0.5 * dotProduct + 0.5 ) ) ).xyz;totalDiffuse += diffuse * spotLightColor[ i ] * lDistance * spotEffect;\n#else\ntotalDiffuse += diffuse * spotLightColor[ i ] * spotDiffuseWeight * lDistance * spotEffect;\n#endif\nvec3 spotHalfVector = normalize( lVector + viewPosition );float spotDotNormalHalf = max( dot( normal, spotHalfVector ), 0.0 );float spotSpecularWeight = specularStrength * pow( spotDotNormalHalf, shininess );\n#ifdef PHYSICALLY_BASED_SHADING\nfloat specularNormalization = ( shininess + 2.0001 ) / 8.0;vec3 schlick = specular + vec3( 1.0 - specular ) * pow( 1.0 - dot( lVector, spotHalfVector ), 5.0 );totalSpecular += schlick * spotLightColor[ i ] * spotSpecularWeight * spotDiffuseWeight * lDistance * specularNormalization * spotEffect;\n#else\ntotalSpecular += specular * spotLightColor[ i ] * spotSpecularWeight * spotDiffuseWeight * lDistance * spotEffect;\n#endif\n}}\n#endif\n#if MAX_DIR_LIGHTS > 0\nfor( int i = 0; i < MAX_DIR_LIGHTS; i ++ ) {vec4 lDirection = viewMatrix * vec4( directionalLightDirection[ i ], 0.0 );vec3 dirVector = normalize( lDirection.xyz );float dotProduct = dot( normal, dirVector );\n#ifdef WRAP_AROUND\nfloat dirDiffuseWeightFull = max( dotProduct, 0.0 );float dirDiffuseWeightHalf = max( 0.5 * dotProduct + 0.5, 0.0 );vec3 dirDiffuseWeight = mix( vec3( dirDiffuseWeightFull ), vec3( dirDiffuseWeightHalf ), wrapRGB );\n#else\nfloat dirDiffuseWeight = max( dotProduct, 0.0 );\n#endif\n#ifdef MMD_TOONMAP\ntotalToon += texture2D( mmdToonMap, vec2( 0.0, 1.0 - ( 0.5 * dotProduct + 0.5 ) ) ).xyz;totalDiffuse += diffuse * directionalLightColor[ i ];\n#else\ntotalDiffuse += diffuse * directionalLightColor[ i ] * dirDiffuseWeight;\n#endif\nvec3 dirHalfVector = normalize( dirVector + viewPosition );float dirDotNormalHalf = max( dot( normal, dirHalfVector ), 0.0 );float dirSpecularWeight = specularStrength * pow( dirDotNormalHalf, shininess );\n#ifdef PHYSICALLY_BASED_SHADING\nfloat specularNormalization = ( shininess + 2.0001 ) / 8.0;vec3 schlick = specular + vec3( 1.0 - specular ) * pow( 1.0 - dot( dirVector, dirHalfVector ), 5.0 );totalSpecular += schlick * directionalLightColor[ i ] * dirSpecularWeight * dirDiffuseWeight * specularNormalization;\n#else\ntotalSpecular += specular * directionalLightColor[ i ] * dirSpecularWeight * dirDiffuseWeight;\n#endif\n}\n#endif\n#if MAX_HEMI_LIGHTS > 0\nfor( int i = 0; i < MAX_HEMI_LIGHTS; i ++ ) {vec4 lDirection = viewMatrix * vec4( hemisphereLightDirection[ i ], 0.0 );vec3 lVector = normalize( lDirection.xyz );float dotProduct = dot( normal, lVector );float hemiDiffuseWeight = 0.5 * dotProduct + 0.5;\n#ifdef MMD_TOONMAP\ntotalToon += texture2D( mmdToonMap, vec2( 0.0, 1.0 - hemiDiffuseWeight ) ).xyz;\n#endif\nvec3 hemiColor = mix( hemisphereLightGroundColor[ i ], hemisphereLightSkyColor[ i ], hemiDiffuseWeight );totalDiffuse += diffuse * hemiColor;vec3 hemiHalfVectorSky = normalize( lVector + viewPosition );float hemiDotNormalHalfSky = 0.5 * dot( normal, hemiHalfVectorSky ) + 0.5;float hemiSpecularWeightSky = specularStrength * pow( hemiDotNormalHalfSky, shininess );vec3 lVectorGround = -lVector;vec3 hemiHalfVectorGround = normalize( lVectorGround + viewPosition );float hemiDotNormalHalfGround = 0.5 * dot( normal, hemiHalfVectorGround ) + 0.5;float hemiSpecularWeightGround = specularStrength * pow( hemiDotNormalHalfGround, shininess );\n#ifdef PHYSICALLY_BASED_SHADING\nfloat dotProductGround = dot( normal, lVectorGround );float specularNormalization = ( shininess + 2.0001 ) / 8.0;vec3 schlickSky = specular + vec3( 1.0 - specular ) * pow( 1.0 - dot( lVector, hemiHalfVectorSky ), 5.0 );vec3 schlickGround = specular + vec3( 1.0 - specular ) * pow( 1.0 - dot( lVectorGround, hemiHalfVectorGround ), 5.0 );totalSpecular += hemiColor * specularNormalization * ( schlickSky * hemiSpecularWeightSky * max( dotProduct, 0.0 ) + schlickGround * hemiSpecularWeightGround * max( dotProductGround, 0.0 ) );\n#else\ntotalSpecular += specular * hemiColor * ( hemiSpecularWeightSky + hemiSpecularWeightGround ) * hemiDiffuseWeight;\n#endif\n}\n#endif\n#ifdef MMD\ntotalSpecular = max( totalSpecular, 0.0 );\n#endif\n#ifdef METAL\ngl_FragColor.xyz = gl_FragColor.xyz * ( emissive + totalDiffuse + ambientLightColor * ambient + totalSpecular );\n#else\ngl_FragColor.xyz = gl_FragColor.xyz * ( emissive + totalDiffuse + ambientLightColor * ambient ) + totalSpecular;\n#endif\n#ifdef MMD_TOONMAP\ngl_FragColor.xyz *= totalToon;\n#endif\n#endif\n#ifdef USE_LIGHTMAP\ngl_FragColor = gl_FragColor * texture2D( lightMap, vUv2 );\n#endif\n#ifdef USE_COLOR\ngl_FragColor = gl_FragColor * vec4( vColor, opacity );\n#endif\n#ifdef USE_ENVMAP\nvec3 reflectVec;\n#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP )\nvec3 cameraToVertex = normalize( vWorldPosition - cameraPosition );if ( useRefract ) {reflectVec = refract( cameraToVertex, normal, refractionRatio );} else {reflectVec = reflect( cameraToVertex, normal );}\n#else\nreflectVec = vReflect;\n#endif\n#ifdef DOUBLE_SIDED\nfloat flipNormal = ( -1.0 + 2.0 * float( gl_FrontFacing ) );vec4 cubeColor = textureCube( envMap, flipNormal * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );\n#else\nvec4 cubeColor = textureCube( envMap, vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );\n#endif\n#ifdef GAMMA_INPUT\ncubeColor.xyz *= cubeColor.xyz;\n#endif\nif ( combine == 1 ) {gl_FragColor.xyz = mix( gl_FragColor.xyz, cubeColor.xyz, specularStrength * reflectivity );} else if ( combine == 2 ) {gl_FragColor.xyz += cubeColor.xyz * specularStrength * reflectivity;} else {gl_FragColor.xyz = mix( gl_FragColor.xyz, gl_FragColor.xyz * cubeColor.xyz, specularStrength * reflectivity );}\n#endif\n#ifdef USE_SHADOWMAP\n#ifdef MMD\nif (mmdShadowDark > 0.0) {\n#endif\n#ifdef SHADOWMAP_DEBUG\nvec3 frustumColors[3];frustumColors[0] = vec3( 1.0, 0.5, 0.0 );frustumColors[1] = vec3( 0.0, 1.0, 0.8 );frustumColors[2] = vec3( 0.0, 0.5, 1.0 );\n#endif\n#ifdef SHADOWMAP_CASCADE\nint inFrustumCount = 0;\n#endif\nfloat fDepth;vec3 shadowColor = vec3( 1.0 );for( int i = 0; i < MAX_SHADOWS; i ++ ) {vec3 shadowCoord = vShadowCoord[ i ].xyz / vShadowCoord[ i ].w;bvec4 inFrustumVec = bvec4 ( shadowCoord.x >= 0.0, shadowCoord.x <= 1.0, shadowCoord.y >= 0.0, shadowCoord.y <= 1.0 );bool inFrustum = all( inFrustumVec );\n#ifdef SHADOWMAP_CASCADE\ninFrustumCount += int( inFrustum );bvec3 frustumTestVec = bvec3( inFrustum, inFrustumCount == 1, shadowCoord.z <= 1.0 );\n#else\nbvec2 frustumTestVec = bvec2( inFrustum, shadowCoord.z <= 1.0 );\n#endif\nbool frustumTest = all( frustumTestVec );if ( frustumTest ) {shadowCoord.z += shadowBias[ i ];\n#ifdef MMD\nfloat darkness = mmdShadowDark;\n#else\nfloat darkness = shadowDarkness[ i ];\n#endif\n#if defined( SHADOWMAP_TYPE_PCF )\nfloat shadow = 0.0;const float shadowDelta = 1.0 / 9.0;float xPixelOffset = 1.0 / shadowMapSize[ i ].x;float yPixelOffset = 1.0 / shadowMapSize[ i ].y;float dx0 = -1.25 * xPixelOffset;float dy0 = -1.25 * yPixelOffset;float dx1 = 1.25 * xPixelOffset;float dy1 = 1.25 * yPixelOffset;fDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx0, dy0 ) ) );if ( fDepth < shadowCoord.z ) shadow += shadowDelta;fDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( 0.0, dy0 ) ) );if ( fDepth < shadowCoord.z ) shadow += shadowDelta;fDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx1, dy0 ) ) );if ( fDepth < shadowCoord.z ) shadow += shadowDelta;fDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx0, 0.0 ) ) );if ( fDepth < shadowCoord.z ) shadow += shadowDelta;fDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy ) );if ( fDepth < shadowCoord.z ) shadow += shadowDelta;fDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx1, 0.0 ) ) );if ( fDepth < shadowCoord.z ) shadow += shadowDelta;fDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx0, dy1 ) ) );if ( fDepth < shadowCoord.z ) shadow += shadowDelta;fDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( 0.0, dy1 ) ) );if ( fDepth < shadowCoord.z ) shadow += shadowDelta;fDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx1, dy1 ) ) );if ( fDepth < shadowCoord.z ) shadow += shadowDelta;shadowColor = shadowColor * vec3( ( 1.0 - darkness * shadow ) );\n#elif defined( SHADOWMAP_TYPE_PCF_SOFT )\nfloat shadow = 0.0;float xPixelOffset = 1.0 / shadowMapSize[ i ].x;float yPixelOffset = 1.0 / shadowMapSize[ i ].y;float dx0 = -1.0 * xPixelOffset;float dy0 = -1.0 * yPixelOffset;float dx1 = 1.0 * xPixelOffset;float dy1 = 1.0 * yPixelOffset;mat3 shadowKernel;mat3 depthKernel;depthKernel[0][0] = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx0, dy0 ) ) );depthKernel[0][1] = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx0, 0.0 ) ) );depthKernel[0][2] = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx0, dy1 ) ) );depthKernel[1][0] = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( 0.0, dy0 ) ) );depthKernel[1][1] = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy ) );depthKernel[1][2] = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( 0.0, dy1 ) ) );depthKernel[2][0] = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx1, dy0 ) ) );depthKernel[2][1] = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx1, 0.0 ) ) );depthKernel[2][2] = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx1, dy1 ) ) );vec3 shadowZ = vec3( shadowCoord.z );shadowKernel[0] = vec3(lessThan(depthKernel[0], shadowZ ));shadowKernel[0] *= vec3(0.25);shadowKernel[1] = vec3(lessThan(depthKernel[1], shadowZ ));shadowKernel[1] *= vec3(0.25);shadowKernel[2] = vec3(lessThan(depthKernel[2], shadowZ ));shadowKernel[2] *= vec3(0.25);vec2 fractionalCoord = 1.0 - fract( shadowCoord.xy * shadowMapSize[i].xy );shadowKernel[0] = mix( shadowKernel[1], shadowKernel[0], fractionalCoord.x );shadowKernel[1] = mix( shadowKernel[2], shadowKernel[1], fractionalCoord.x );vec4 shadowValues;shadowValues.x = mix( shadowKernel[0][1], shadowKernel[0][0], fractionalCoord.y );shadowValues.y = mix( shadowKernel[0][2], shadowKernel[0][1], fractionalCoord.y );shadowValues.z = mix( shadowKernel[1][1], shadowKernel[1][0], fractionalCoord.y );shadowValues.w = mix( shadowKernel[1][2], shadowKernel[1][1], fractionalCoord.y );shadow = dot( shadowValues, vec4( 1.0 ) );shadowColor = shadowColor * vec3( ( 1.0 - darkness * shadow ) );\n#else\nvec4 rgbaDepth = texture2D( shadowMap[ i ], shadowCoord.xy );float fDepth = unpackDepth( rgbaDepth );if ( fDepth < shadowCoord.z )shadowColor = shadowColor * vec3( 1.0 - darkness );\n#endif\n}\n#ifdef SHADOWMAP_DEBUG\n#ifdef SHADOWMAP_CASCADE\nif ( inFrustum && inFrustumCount == 1 ) gl_FragColor.xyz *= frustumColors[ i ];\n#else\nif ( inFrustum ) gl_FragColor.xyz *= frustumColors[ i ];\n#endif\n#endif\n}\n#ifdef GAMMA_OUTPUT\nshadowColor *= shadowColor;\n#endif\ngl_FragColor.xyz = gl_FragColor.xyz * shadowColor;\n#ifdef MMD\n}\n#endif\n#endif\n#ifdef GAMMA_OUTPUT\ngl_FragColor.xyz = sqrt( gl_FragColor.xyz );\n#endif\n#ifdef MMD\n}\n#endif\n#ifdef USE_FOG\nfloat depth = gl_FragCoord.z / gl_FragCoord.w;\n#ifdef FOG_EXP2\nconst float LOG2 = 1.442695;float fogFactor = exp2( - fogDensity * fogDensity * depth * depth * LOG2 );fogFactor = 1.0 - clamp( fogFactor, 0.0, 1.0 );\n#else\nfloat fogFactor = smoothstep( fogNear, fogFar, depth );\n#endif\ngl_FragColor = mix( gl_FragColor, vec4( fogColor, gl_FragColor.w ), fogFactor );\n#endif\n}'
};
/*
// load shaders
loadText( 'MMD_vs.txt', function( xhr ) {
	MMDShader.vertexShader = xhr.response;
});
loadText( 'MMD_fs.txt', function( xhr ) {
	MMDShader.fragmentShader = xhr.response;
});
*/
MMDMaterial = function(parameters) {
	THREE.ShaderMaterial.call(this);

	// like MeshPhongMaterial
	this.color = new THREE.Color( 0xffffff ); // diffuse
	this.ambient = new THREE.Color( 0xffffff );
	this.emissive = new THREE.Color( 0x000000 );
	this.specular = new THREE.Color( 0x111111 );
	this.shininess = 30;
	this.metal = false;
	this.perPixel = false;
	this.wrapAround = false;
	this.wrapRGB = new THREE.Vector3( 1, 1, 1 );
	this.map = null;
	this.lightMap = null;
	this.bumpMap = null;
	this.bumpScale = 1;
	this.normalMap = null;
	this.normalScale = new THREE.Vector2( 1, 1 );
	this.specularMap = null;
	this.envMap = null;
	this.combine = THREE.MultiplyOperation;
	this.reflectivity = 1;
	this.refractionRatio = 0.98;
	this.wireframeLinecap = 'round';
	this.wireframeLinejoin = 'round';

	// MMD specific
	//this.alphaTest = 1/256;
	this.castShadow = true;
	this.shadowMapCullFace = THREE.CullFaceFront;
	this.mmdToonMap = null;
	this.mmdSphereMap = null;
	this.mmdSphereMode = 0;
	this.mmdEdgeColor = new THREE.Vector4(0,0,0,1); // rgba
	this.mmdEdgeThick = 0;
	this.mmdShadowDark = 0; // これがゼロならセルフ影は描画しない。
	this.passes = 1;
	this.preRenderPass = null;
	this.postRenderPass = null;
	this.uniforms = THREE.UniformsUtils.clone(MMDShader.uniforms);
	this.vertexShader = MMDShader.vertexShader;
	this.fragmentShader = MMDShader.fragmentShader;

	this.setValues( parameters );
};
MMDMaterial.prototype = Object.create(THREE.ShaderMaterial.prototype);
MMDMaterial.prototype.constructor = MMDMaterial;

MMDMaterial.prototype.setup = function() {
	if (this.opacity <= 0) {
		// ※ material morph 対応時は改修が必要。
		this.passes = -1; // render cancel
		this.preRenderPass = this.postRenderPass = null;
	} else
	if (this.mmdEdgeThick > 0) {
		// setup RenderPass
		this.passes = 2; // multipass
		this.preRenderPass = function(renderer, pass) { // callback in renderBuffer()
			var gl, mmdEdgeThick, renderCancel;
			//if (this.opacity <= 0) {
			//	return true; // render cancel
			//}
			gl = renderer.context;
			if (pass === 0) {
				// pass 0
				if (this.side === THREE.DoubleSide) {
					gl.disable( gl.CULL_FACE );
				} else {
					gl.enable( gl.CULL_FACE );
					gl.cullFace( gl.BACK );
				}
				mmdEdgeThick = 0;
				renderCancel = false;
			} else {
				// pass 1
				gl.enable( gl.CULL_FACE );
				gl.cullFace( gl.FRONT );
				//param = gl.getParameter( gl.VIEWPORT ); // [x,y,w,h] : int32Array
				//mmdEdgeThick = this.mmdEdgeThick * 2 / param[3];
				//glからのVIEWPORT取得は時間を要するようなのでココでやるのはマズイみたい(^_^;)
				//renderer側を改造して取得できるようにした。
				mmdEdgeThick = this.mmdEdgeThick * 2 / renderer.getViewportHeight();
				renderCancel = (mmdEdgeThick <= 0);
			}
			gl.uniform1f(this.program.uniforms.mmdEdgeThick, mmdEdgeThick);
			return renderCancel;
		};
		this.postRenderPass = function(renderer, pass) { // callback in renderBuffer()
			var gl;
			//if (this.opacity <= 0) {
			//	return;
			//}
			gl = renderer.context;
			gl.enable( gl.CULL_FACE );
			gl.cullFace( gl.BACK );
		};
	} else {
		// １パス時においても、three.js側の状況に関わらず独自にやらないとうまく行かないことがある。
		this.passes = 1;
		this.preRenderPass = function(renderer, pass) { // callback in renderBuffer()
			var gl;
			gl = renderer.context;
			if (this.side === THREE.DoubleSide) {
				gl.disable( gl.CULL_FACE );
			} else {
				gl.enable( gl.CULL_FACE );
				gl.cullFace( gl.BACK );
			}
		};
		this.postRenderPass = function(renderer, pass) { // callback in renderBuffer()
			var gl;
			gl = renderer.context;
			gl.enable( gl.CULL_FACE );
			gl.cullFace( gl.BACK );
		};
	}
	if (this.mmdToonMap) {
		this.defines.MMD_TOONMAP = ''; // #define MMD_TOONMAP
	} else {
		delete this.defines.MMD_TOONMAP;
	}
	if (this.mmdSphereMap) {
		this.defines.MMD_SPHEREMAP = this.mmdSphereMode.toString(); // #define MMD_SPHEREMAP
	} else {
		delete this.defines.MMD_SPHEREMAP;
	}
	this.needsUpdate = true;
};

// renderer の setProgram() から callback される。
MMDMaterial.prototype.refreshUniforms = function(renderer) {
	var uniforms = this.uniforms;

// --- Common ---
// based on refreshUniformsCommon() @ WebGLRenderer.js
	uniforms.opacity.value = this.opacity;

	if ( renderer.gammaInput ) {

		uniforms.diffuse.value.copyGammaToLinear( this.color );

	} else {

		uniforms.diffuse.value = this.color;

	}

	uniforms.map.value = this.map;
	uniforms.lightMap.value = this.lightMap;
	uniforms.specularMap.value = this.specularMap;

	if ( this.bumpMap ) {

		uniforms.bumpMap.value = this.bumpMap;
		uniforms.bumpScale.value = this.bumpScale;

	}

	if ( this.normalMap ) {

		uniforms.normalMap.value = this.normalMap;
		uniforms.normalScale.value.copy( this.normalScale );

	}

	// uv repeat and offset setting priorities
	//	1. color map
	//	2. specular map
	//	3. normal map
	//	4. bump map

	var uvScaleMap;

	if ( this.map ) {

		uvScaleMap = this.map;

	} else if ( this.specularMap ) {

		uvScaleMap = this.specularMap;

	} else if ( this.normalMap ) {

		uvScaleMap = this.normalMap;

	} else if ( this.bumpMap ) {

		uvScaleMap = this.bumpMap;

	}

	if ( uvScaleMap !== undefined ) {

		var offset = uvScaleMap.offset;
		var repeat = uvScaleMap.repeat;

		uniforms.offsetRepeat.value.set( offset.x, offset.y, repeat.x, repeat.y );

	}

	uniforms.envMap.value = this.envMap;
	uniforms.flipEnvMap.value = ( this.envMap instanceof THREE.WebGLRenderTargetCube ) ? 1 : -1;

	if ( renderer.gammaInput ) {

		//uniforms.reflectivity.value = this.reflectivity * this.reflectivity;
		uniforms.reflectivity.value = this.reflectivity;

	} else {

		uniforms.reflectivity.value = this.reflectivity;

	}

	uniforms.refractionRatio.value = this.refractionRatio;
	uniforms.combine.value = this.combine;
	uniforms.useRefract.value = this.envMap && this.envMap.mapping instanceof THREE.CubeRefractionMapping;

// --- Phong ---
// based on refreshUniformsPhong() @ WebGLRenderer.js
	uniforms.shininess.value = this.shininess;

	if ( renderer.gammaInput ) {

		uniforms.ambient.value.copyGammaToLinear( this.ambient );
		uniforms.emissive.value.copyGammaToLinear( this.emissive );
		uniforms.specular.value.copyGammaToLinear( this.specular );

	} else {

		uniforms.ambient.value = this.ambient;
		uniforms.emissive.value = this.emissive;
		uniforms.specular.value = this.specular;

	}

	if ( this.wrapAround ) {

		uniforms.wrapRGB.value.copy( this.wrapRGB );

	}

// --- MMD ---
	if (this.mmdToonMap) {
		uniforms.mmdToonMap.value = this.mmdToonMap;
	}
	if (this.mmdSphereMap) {
		uniforms.mmdSphereMap.value = this.mmdSphereMap;
	}
	//uniforms.mmdEdgeThick.value = this.mmdEdgeThick;
	uniforms.mmdEdgeColor.value = this.mmdEdgeColor;
	uniforms.mmdShadowDark.value = this.mmdShadowDark;
};

(function() { // MMDIK
// !!! bone.visible を内部的なフラグとして流用しているので注意。!!!
var targetPos, targetVec, effectorVec, axis/*, tv*/, q, inv,
	getMatrix, setGlobalPosition, setGlobalMatrixInverse;

targetPos = new THREE.Vector3();
targetVec = new THREE.Vector3();
effectorVec = new THREE.Vector3();
axis = new THREE.Vector3();
//tv = new THREE.Vector3();
q = new THREE.Quaternion();
inv = new THREE.Matrix4();
getMatrix = function(bone) {
	var m = bone.matrix;
	if (bone.visible) {
		// matrixを更新。
		bone.visible = false;
		m.makeRotationFromQuaternion(bone.quaternion);
		m.setPosition(bone.position);
	}
	return m;
};
setGlobalPosition = function(mesh, bone, pos) {
	pos.copy(bone.position);
	while (bone.parent !== mesh) {
		bone = bone.parent;
		pos.applyMatrix4(getMatrix(bone));
	}
};
setGlobalMatrixInverse = function(mesh, bone, inv) {
	inv.copy(getMatrix(bone));
	while (bone.parent !== mesh) {
		bone = bone.parent;
		inv.multiplyMatrices(getMatrix(bone), inv);
	}
	inv.getInverse(inv);
};

// inverse kinematic solver
MMDIK = function( mesh ) {
	this.mesh = mesh;
};
MMDIK.prototype.update = function() {
	var mesh,iks,bones,a,al,ik,ikl,i,j,il,jl,target,effector,link,angle,t;
	mesh = this.mesh;
	bones = mesh.bones;
	iks = mesh.geometry.MMDIKs;
	for (a=0,al=iks.length; a<al; a++) {
		ik = iks[a];
		target = bones[ik.target];
		effector = bones[ik.effector];
		//if (effector.omitIK) {
		//	continue; // cancel
		//}
		setGlobalPosition(mesh, target, targetPos);
		il = ik.iteration;
		jl = ik.links.length;
		// リンクの回転を初期化。
		for (j=0; j<jl; j++) {
			ikl = ik.links[j];
			link = bones[ikl.bone];
			link.quaternion.set(0,0,0,1);
		}
		loop:
		for (i=0; i<il; i++) {
			for (j=0; j<jl; j++) {
				ikl = ik.links[j];
				link = bones[ikl.bone];
				if (link.omitIK) {
					//continue; // cancel
					break loop; // cancel
				}
				setGlobalMatrixInverse(mesh, link, inv);
				setGlobalPosition(mesh, effector, effectorVec); // === effectorPos
				effectorVec.applyProjection(inv).normalize();
				targetVec.copy(targetPos);
				targetVec.applyProjection(inv).normalize();
				angle = targetVec.dot(effectorVec);
				if (angle > 1) { // 誤差対策。
					angle = 1;
				}
				angle = Math.acos(angle);
				if (angle < 1.0e-5) { // 発散対策。
					continue; // 微妙に振動することになるから抜ける方が無難かな。
					//angle = 1.0e-5;
				}
				if (angle > ik.control) {
					angle = ik.control;
				}
				q.setFromAxisAngle((axis.crossVectors(effectorVec, targetVec)).normalize(), angle);
				link.quaternion.multiplyQuaternions(link.quaternion, q);
				if (ikl.limits) { // 実質的に「ひざ」限定。
					// 簡易版
					t = link.quaternion.w;
					link.quaternion.set(Math.sqrt(1 - t * t), 0, 0, t); // X軸回転に限定。
					/* // オイラー角制限版。しかし回転順序はどうすべきか・・・。
					tv.setEulerFromQuaternion(link.quaternion);
					if (tv.x < ikl.limits[0][0]) {
						tv.x = ikl.limits[0][0];
					} else
					if (tv.x > ikl.limits[1][0]) {
						tv.x = ikl.limits[1][0]
					}
					if (tv.y < ikl.limits[0][1]) {
						tv.y = ikl.limits[0][1];
					} else
					if (tv.y > ikl.limits[1][1]) {
						tv.y = ikl.limits[1][1]
					}
					if (tv.z < ikl.limits[0][2]) {
						tv.z = ikl.limits[0][2];
					} else
					if (tv.z > ikl.limits[1][2]) {
						tv.z = ikl.limits[1][2]
					}
					link.quaternion.setFromEuler(tv); */
				}
				//link.quaternion.normalize();
				link.visible = true; // matrixの更新を指示。
			}
		}
	}
	bones.forEach(function(v) {
		v.visible = true; // 元に戻す。
	});
};

}()); // MMDIK

(function() { // physics

var btConfiguration, btDispatcher, btSolver, btBroadphase,
	_btransform, _bv, _bq,
	_v, _v2, _v3, _q, _q2, _q3, _mtx, _mtx2,
	getLocalRigidPos;

// create physics world
btConfiguration = new Ammo.btDefaultCollisionConfiguration();
btDispatcher = new Ammo.btCollisionDispatcher( btConfiguration );
btSolver = new Ammo.btSequentialImpulseConstraintSolver();
btBroadphase = new Ammo.btDbvtBroadphase();
btWorld = new Ammo.btDiscreteDynamicsWorld( btDispatcher, btBroadphase, btSolver, btConfiguration );

// physics temporary
_btransform = new Ammo.btTransform();
_bv = new Ammo.btVector3();
_bq = new Ammo.btQuaternion();
tmpBV = function( x,y,z ) {
	_bv.setValue( x,y,z );
	return _bv;
};
tmpBQ = function( x,y,z,w ) {
	_bq.setValue( x,y,z,w );
	return _bq;
};

// temporary
_v = new THREE.Vector3();
_v2 = new THREE.Vector3();
_v3 = new THREE.Vector3();
_q = new THREE.Quaternion();
_q2 = new THREE.Quaternion();
_q3 = new THREE.Quaternion();
_mtx = new THREE.Matrix4();
_mtx2 = new THREE.Matrix4();

// 剛体の座標をワールドからローカルへ
getLocalRigidPos = function(joint, rigid) {
	_v.set( rigid.rot[0], rigid.rot[1], rigid.rot[2] );
	_mtx.makeRotationFromEuler( _v );
	_mtx.getInverse(_mtx);
	_v.set( joint.pos[0] - rigid.pos[0], joint.pos[1] - rigid.pos[1], joint.pos[2] - rigid.pos[2] );
	return _v.applyProjection(_mtx); // 逆行列の場合は applyMatrix4() ではなく applyProjection() で。
};

MMDPhysi = function( mesh ) {
	this.create( mesh );
};
MMDPhysi.prototype.create = function( mesh ) {
	var rigids = mesh.geometry.MMDrigids,
		joints = mesh.geometry.MMDjoints;

	this.mesh = mesh;

	// setup rigid bodies
	rigids.forEach(function(v) {
		var bone, shape, mass, localInertia, motionState, rbInfo, body;

		// バインドポーズ時の回転量を求める。
		v.q = new THREE.Quaternion();
		v.q.setFromEuler(new THREE.Vector3(v.rot[0], v.rot[1], v.rot[2]));
		if (v.bone >= 0) {
			bone = mesh.bones[v.bone];
			if (v.type > 0) {
				// 動的剛体に対応しているボーンはIK対象から除外。
				bone.omitIK = true;
			}
		} else {
			if (v.type === 2) {
				// 関連ボーンが無いのでボーン位置合わせはできない。
				v.type = 1;
				//console.log(v.name + ' type 2 -> 1');
			}
		}

		switch(v.shape) {
		case 0:
			shape = new Ammo.btSphereShape(v.size[0]);
			break;
		case 1:
			shape = new Ammo.btBoxShape(tmpBV(v.size[0], v.size[1], v.size[2]));
			break;
		case 2:
			shape = new Ammo.btCapsuleShape(v.size[0], v.size[1]);
			break;
		default:
			return;
		}
		mass = (v.type === 0 ? 0 : v.mass);
		localInertia = new Ammo.btVector3(0, 0, 0);
		shape.calculateLocalInertia( mass, localInertia );
		_btransform.setIdentity();
		_btransform.setOrigin(tmpBV( v.pos[0] + mesh.position.x, v.pos[1] + mesh.position.y, v.pos[2] + mesh.position.z ));
		_btransform.setRotation(tmpBQ( v.q.x, v.q.y, v.q.z, v.q.w ));
		motionState = new Ammo.btDefaultMotionState( _btransform );
		rbInfo = new Ammo.btRigidBodyConstructionInfo( mass, motionState, shape, localInertia );
		rbInfo.set_m_friction( v.friction );
		rbInfo.set_m_restitution( v.restitution );
		body = new Ammo.btRigidBody( rbInfo );
		if (v.type === 0) {
			body.setCollisionFlags( body.getCollisionFlags() | 2 ); // KINEMATIC
			//body.setActivationState( 4 ); // DISABLE_DEACTIVATION
		//} else {
		//	body.setActivationState( 4 ); // DISABLE_DEACTIVATION
		}
		body.setDamping(v.posDamping, v.rotDamping);
		body.setSleepingThresholds(0, 0);
		btWorld.addRigidBody(body, 1 << v.group, v.mask);
		Ammo.destroy(rbInfo);
		Ammo.destroy(localInertia);
		v.body = body;
	});

	// setup constraints
	joints.forEach(function(v) {
		var p, r, c, i, ba, bb, //namea, nameb, 
			ra = rigids[v.rigidA],
			rb = rigids[v.rigidB],
			ta = new Ammo.btTransform(),
			tb = new Ammo.btTransform();

		/* if (ra.bone > 0) {
			namea = mesh.bones[ra.bone].name;
		}
		if (rb.bone > 0) {
			nameb = mesh.bones[rb.bone].name;
		}
		console.log(namea + ':' + ra.type + ' -> ' + nameb + ':' + rb.type); */
		if (ra.type !== 0 && rb.type === 2) {
			// 親側が静的剛体で無い場合は、子側のボーン位置合わせは無効にしないといけないようだ。
			if (ra.bone > 0) {
				ba = mesh.bones[ra.bone];
			}
			if (rb.bone > 0) {
				bb = mesh.bones[rb.bone];
			}
			if (ba && bb && bb.parent === ba) {
				rb.type = 1; // 通常の動的剛体。
				//console.log('!!! ' + nameb + ' type 2 -> 1');
			}
		}

		ta.setIdentity();
		p = getLocalRigidPos(v,ra);
		ta.setOrigin(tmpBV( p.x, p.y, p.z ));
		r = ta.getRotation();
		r.setEulerZYX( -ra.rot[2], -ra.rot[1], -ra.rot[0] );
		ta.setRotation( r );

		tb.setIdentity();
		p = getLocalRigidPos(v,rb);
		tb.setOrigin(tmpBV( p.x, p.y, p.z ));
		r = tb.getRotation();
		r.setEulerZYX( -rb.rot[2], -rb.rot[1], -rb.rot[0] );
		tb.setRotation( r );

		c = new Ammo.btGeneric6DofSpringConstraint(
			ra.body,
			rb.body,
			ta,
			tb
		);
		c.setLinearLowerLimit(tmpBV( v.posLower[0], v.posLower[1], v.posLower[2] ));
		c.setLinearUpperLimit(tmpBV( v.posUpper[0], v.posUpper[1], v.posUpper[2] ));
		c.setAngularLowerLimit(tmpBV( v.rotLower[0], v.rotLower[1], v.rotLower[2] ));
		c.setAngularUpperLimit(tmpBV( v.rotUpper[0], v.rotUpper[1], v.rotUpper[2] ));
		for (i=0;i<3;i++) {
			if (v.posSpring[i] > 0) {
				c.setStiffness(i, v.posSpring[i]);
				c.enableSpring(i, true);
			}
			if (v.rotSpring[i] > 0) {
				c.setStiffness(i+3, v.rotSpring[i]);
				c.enableSpring(i+3, true);
			}
		}
		//c.setEquilibriumPoint(); // バネの復元基準。
		//c.enableFeedback();
			///enableFeedback will allow to read the applied linear and angular impulse
			///use getAppliedImpulse, getAppliedLinearImpulse and getAppliedAngularImpulse to read feedback information
		for (i=0; i<6; i++) {
			//c.setParam( 1, 0.45, i); // BT_CONSTRAINT_ERP (6DOFSpringではやっても意味ないぽい)
			c.setParam( 2, MMD.STOP_ERP, i); // BT_CONSTRAINT_STOP_ERP (default=0.2)
			//c.setParam( 3, 0.0, i); // BT_CONSTRAINT_CFM
			//c.setParam( 4, 0.0, i); // BT_CONSTRAINT_STOP_CFM
		}
		btWorld.addConstraint( c, true ); // disableCollisionsBetweenLinkedBodies
		Ammo.destroy(ta);
		Ammo.destroy(tb);
		v.constraint = c;
	});
};
MMDPhysi.prototype.dispose = function() {
	this.mesh.geometry.MMDjoints.forEach( function(v) {
		btWorld.removeConstraint( v.constraint );
		Ammo.destroy( v.constraint );
		delete v.constraint;
	});
	this.mesh.geometry.MMDrigids.forEach( function(v) {
		btWorld.removeRigidBody( v.body );
		Ammo.destroy( v.body );
		delete v.body;
	});
};
MMDPhysi.prototype.preSimulate = function() { // ボーン→静的剛体
	var mesh;
	mesh = this.mesh;
	_q2.setFromRotationMatrix( mesh.matrixWorld );
	mesh.geometry.MMDrigids.forEach(function(v) {
		var skin, body;
		if (v.type === 0 && v.bone >= 0) {
			skin = mesh.bones[v.bone].skinMatrix;

			// ボーンの位置と回転を剛体へ変換
			_v.set( v.ofs[0], v.ofs[1], v.ofs[2] );
			_v.applyMatrix4( skin ); // ボーンorigin→剛体origin
			_v.applyMatrix4( mesh.matrixWorld ); // モデルローカル→ワールド
			_q.setFromRotationMatrix( skin ); // ボーンのグローバル回転量。
			_q.multiplyQuaternions( _q, v.q ); // バインドポーズ時の回転量を加える。
			_q.multiplyQuaternions( _q2, _q ); // モデルローカル→ワールド

			// 剛体のワールド位置と回転。
			body = v.body;
			body.getMotionState().getWorldTransform( _btransform );
			//body.getWorldTransform( _btransform );
			_btransform.setOrigin( tmpBV( _v.x, _v.y, _v.z ) );
			_btransform.setRotation( tmpBQ( _q.x, _q.y, _q.z, _q.w ) );
			body.setWorldTransform( _btransform );
			//body.activate();
		}
	});
};
MMDPhysi.prototype.postSimulate = function() { // 動的剛体→ボーン
	var mesh, b, bl;
	mesh = this.mesh;
	_mtx2.getInverse( mesh.matrixWorld );
	_q3.setFromRotationMatrix( _mtx2 );
	mesh.geometry.MMDrigids.forEach(function(v) {
		var skin,tr,o,r,body;
		if ( v.type !== 0 && v.bone >= 0 ) {
			skin = mesh.bones[v.bone].skinMatrix;
			if (v.type === 2) {
				// ボーンの位置を覚えておく。
				_v3.getPositionFromMatrix(skin);
			}
			tr = v.body.getCenterOfMassTransform();
			r = tr.getRotation();
			_q.set( r.x(), r.y(), r.z(), r.w() );
			_q.multiplyQuaternions( _q3, _q ); // ワールド→モデルローカル
			_q2.copy( v.q ).conjugate(); // _q2.copy( v.q ).inverse();
			_q.multiplyQuaternions( _q, _q2 ); // バインドポーズ時の回転量を減じる。
			skin.makeRotationFromQuaternion(_q);
			if (v.type === 1) {
				o = tr.getOrigin();
				_v.set( o.x(), o.y(), o.z() );
				_v.applyProjection( _mtx2 ); // ワールド→モデルローカル
				_v2.set( v.ofs[0], v.ofs[1], v.ofs[2] ).negate();
				_v2.applyMatrix4( skin ); // 剛体origin→ボーンorigin
				_v.add( _v2 );
				skin.setPosition( _v );
			} else {
				// type=2は剛体の回転のみ適用して位置はボーンのをそのまま使う。
				// したがって剛体側の位置をボーンのに合わせるようにする。
				skin.setPosition( _v3 );
				_v.set( v.ofs[0], v.ofs[1], v.ofs[2] );
				_v.applyMatrix4( skin ); // ボーンorigin→剛体origin
				_v.applyMatrix4( mesh.matrixWorld ); // モデルローカル→ワールド
				body = v.body;
				body.getMotionState().getWorldTransform( _btransform );
				//body.getWorldTransform( _btransform );
				_btransform.setOrigin(tmpBV( _v.x, _v.y, _v.z ));
				body.setWorldTransform( _btransform );
				//body.activate();
			}
		}
	});
	// skinMatrixを書き換えたのでboneMatricesを更新。
	for (b = 0, bl = mesh.bones.length; b < bl; b ++ ) {
		_mtx.multiplyMatrices(mesh.bones[b].skinMatrix, mesh.boneInverses[b] );
		_mtx.flattenToArrayOffset( mesh.boneMatrices, b*16 );
	}
	if (mesh.useVertexTexture) {
		mesh.boneTexture.needsUpdate = true;
	}
};
MMDPhysi.prototype.reset = function() { // 初期位置と回転を剛体に設定してリセット。
	var mesh;
	mesh = this.mesh;
	mesh.updateMatrixWorld( true ); // いつ呼ばれるか分からないからこれ必要。
	_q2.setFromRotationMatrix( mesh.matrixWorld );
	mesh.geometry.MMDrigids.forEach( function( v ) {
		var body;
		_v.set( v.pos[0], v.pos[1], v.pos[2] ).applyMatrix4( mesh.matrixWorld );
		_q.multiplyQuaternions( _q2, v.q );
		body = v.body;
		body.getMotionState().getWorldTransform( _btransform );
		_btransform.setOrigin( tmpBV( _v.x, _v.y, _v.z ) );
		_btransform.setRotation( tmpBQ( _q.x, _q.y, _q.z, _q.w ) );
		body.setWorldTransform( _btransform );
	});
};

}()); // physics

// cubic bezier solver : p0=(0,0), p1=(x1,y1), p2=(x2,y2), p3=(1,1)
cubicBezier = (function() {
	var ax, bx, cx, ay, by, cy, epsilon,
		getX = function(t) {
			return ((ax * t + bx) * t + cx) * t;
		},
		getY = function(t) {
			return ((ay * t + by) * t + cy) * t;
		},
		getXD = function(t) {
			return (3 * ax * t + 2 * bx) * t + cx;
		},
		x2t = function(x) { // x に対応するベジェ曲線上の t を求める。
			var t0, t1, t2, x2, d2, i;

			// まずニュートン法でやる。
			// 収束は早いが安定しない（振動する）ことがあるので、ある一定回数だけ試行させる。
			t2 = x;
			for (i = 0; i < 8; i++) {
				x2 = getX(t2) - x;
				if (Math.abs(x2) < epsilon) {
					return t2;
				}
				d2 = getXD(t2);
				if (Math.abs(d2) < 1e-6) {
					break;
				}
				t2 -= x2 / d2;
			}

			// ニュートン法でうまく行かなかった場合は２分法でやり直す。
			// ニュートン法よりは収束は遅いが、安定的に求まる。
			t0 = 0;
			t1 = 1;
			t2 = x;
			if (t2 < t0) {
				return t0;
			}
			if (t2 > t1) {
				return t1;
			}
			while (t0 < t1) {
				x2 = getX(t2);
				if (Math.abs(x2 - x) < epsilon) {
					return t2;
				}
				if (x > x2) {
					t0 = t2;
				} else {
					t1 = t2;
				}
				t2 = (t1 - t0) * 0.5 + t0;
			}
			return t2;
		},
		solver = function( x, x1, y1, x2, y2, eps ) {
			epsilon = eps;
			cx = 3 * x1;
			bx = 3 * (x2 - x1) - cx;
			ax = 1 - cx - bx;
			cy = 3 * y1;
			by = 3 * (y2 - y1) - cy;
			ay = 1 - cy - by;
			return getY(x2t(x));
		};
	return solver;
}());

// key animation handler
Animation = function( targets, duration ) {
	// 基本的には、このクラスを継承し、onupdate をオーバーライドして使うこと。
	// 各ターゲットには keys 、各キーには time のプロパテイが存在している前提なので注意！
	// 補間するには最低２個のキーが必要。そうなってない場合は対象外にする。
	// 各ターゲットの最終キーの time が同じになってないと、
	// ループするたびに各ターゲット間のタイミングがずれて行くことになるので注意！
	if ( !(targets instanceof Array) ) {
		targets = [ targets ]; // convert to array
	}
	this.targets = targets;
	this.duration = duration;
	this.loop = false;
	this.playing = false;
	/* this.resetOnLoop = false; */
	this.minKeyDelta = 0;
	this.reset();
};
Animation.prototype.reset = function() {
	this.time = 0;
	this.targets.forEach( function( v ) {
		v.k = 0;
	});
};
Animation.prototype.seek = function( time, forceUpdate ) {
	var dt;
	dt = time - this.time;
	if ( dt >= 0 ) {
		this.update( dt, forceUpdate );
	} else {
		this.reset();
		this.update( time, forceUpdate );
	}
};
Animation.prototype.play = function( loop ) {
	// 引数なしの場合は以前のloop設定に従う。
	if ( loop !== undefined ) {
		this.loop = loop;
	}
	this.playing = true;
};
Animation.prototype.pause = function() {
	this.playing = false;
};
Animation.prototype.update = function( dt, force ) {
	var that, now, ended;
	if ( !force && !this.playing ) {
		return;
	}
	//if ( dt < 0 ) {
	//	return;
	//}
	that = this;
	now = this.time + dt;
	this.time = now % this.duration;
	ended = false;
	this.targets.forEach( function( v, idx ) {
		var currKey, nextKey, ratio;
		if ( v.keys.length < 2 ) {
			return; // skip
		}
		currKey = v.keys[ v.k ]; //getKey( v, v.k );
		nextKey = v.keys[ v.k+1 ]; //getKey( v, v.k+1 );
		if ( nextKey.time <= now ) {
			if ( that.time < now ) {
				ended = true;
				if ( that.loop /* && !that.resetOnLoop */ ) {
					v.k = 0;
					currKey = v.keys[ v.k ]; //getKey( v, v.k );
					nextKey = v.keys[ v.k+1 ]; //getKey( v, v.k+1 );
					while ( nextKey.time < that.time ) {
						v.k++;
						currKey = v.keys[ v.k ]; //getKey( v, v.k );
						nextKey = v.keys[ v.k+1 ]; //getKey( v, v.k+1 );
					}
				} else {
					that.time = nextKey.time;
				}
			} else {
				do {
					v.k++;
					currKey = v.keys[ v.k ]; //getKey( v, v.k );
					nextKey = v.keys[ v.k+1 ]; //getKey( v, v.k+1 );
				} while ( nextKey.time < that.time );
			}
		}
		if ( nextKey.time - currKey.time <= that.minKeyDelta ) {
			// VMDではタイミングはフレーム番号で管理されており、
			// １フレーム＝1/30秒、つまり30fpsを想定している。
			// 本実装ではフレームではなく秒で管理している。
			// 例えばVMD的にはカメラを１フレームで瞬時に切り替える設定になっていても、
			// 1/60秒で駆動すると２フレームを生成することになるため、
			// 中間フレームの挿入によって瞬時に切り替わった感じがしない。
			// 処理上は間違っているわけではないのだが、視覚的には少々見苦しくなる(^_^;)
			// そこで２つのキーの間隔がある一定時間以下の場合は
			// ratioをゼロに固定してこの現象を回避する。
			// 基本的にはカメラとライトモーションだけに適用すればよいと思う。
			ratio = 0;
		} else {
			ratio = ( that.time - currKey.time ) / ( nextKey.time - currKey.time );
		}
		that.onupdate( currKey, nextKey, ratio, idx );
	});
	if ( ended ) {
		if ( !this.loop ) {
			this.pause();
		}
		if ( this.onended ) {
			this.onended( this );
		}
		/* if ( this.loop && this.resetOnLoop ) {
			this.reset();
		} */
	}
};
Animation.prototype.adjustDuration = function( duration ) {
	// アニメーション時間を調整する（引き伸ばす）。
	// 複数のアニメーション間におけるループタイミングを一致させるために使われることを想定している。
	if ( this.duration >= duration ) {
		return;
	}
	this.duration = duration;
	this.targets.forEach( function( v ) {
		var keys, last;
		keys = v.keys;
		if ( keys.length < 2 ) {
			return;
		}
		last = keys[ keys.length - 1 ];
		if ( last.time < duration ) {
			last = cloneKey( last );
			last.time = duration;
			keys.push( last );
			//console.log( 'extend duration = ' + duration);
		}
	});
};
/* Animation.prototype.onupdate = function( currKey, nextKey, ratio, targetIdx ) {
	// need to override
}; */

// vertex morphing animaion
MMDMorph = function( mesh, animation ) { // extend Animation
	var geo, targets;
	this.mesh = mesh;
	Animation.call( this, animation.targets, animation.duration );

	// setup morph targets
	targets = animation.targets;
	geo = mesh.geometry;
	geo.morphTargets = [];
	geo.MMDmorphs.forEach( function( v ) {
		var target, vertices, idx;
		idx = geo.morphTargets.length;
		if ( idx < targets.length && v.name === targets[ idx ].keys[0].name ) {
			vertices = [];
			geo.vertices.forEach( function( w ) {
				vertices.push( w.clone() );
			});
			v.items.forEach( function( w ) {
				var p = vertices[ w.target ];
				p.x += w.offset[0];
				p.y += w.offset[1];
				p.z += w.offset[2];
			});
			target = {};
			target.name = v.name;
			target.vertices = vertices;
			geo.morphTargets.push( target );
		}
	});
	if ( geo.morphTargets.length > 0 ) {
		geo.morphTargetsNeedUpdate = true;
		mesh.updateMorphTargets();
		mesh.material.materials.forEach( function( v ) {
			v.morphTargets = true;
			v.needsUpdate = true;
		});
	}
	//this.update(0);
};
MMDMorph.prototype = Object.create( Animation.prototype );
MMDMorph.prototype.constructor = MMDMorph;

MMDMorph.prototype.onupdate = function( currKey, nextKey, ratio, idx) {
	this.mesh.morphTargetInfluences[idx] = currKey.weight + ( nextKey.weight - currKey.weight ) * ratio;
};

(function() { // MMDSkin

var slerp, bezierp, _q;

slerp = function( qa, qb, qm, t ) {
	var cosHalfTheta, halfTheta, sinHalfTheta, ratioA, ratioB;
	cosHalfTheta =  qa[0] * qb[0] + qa[1] * qb[1] + qa[2] * qb[2] + qa[3] * qb[3];
	if ( cosHalfTheta < 0 ) {
		qm[0] = -qb[0];
		qm[1] = -qb[1];
		qm[2] = -qb[2];
		qm[3] = -qb[3];
		cosHalfTheta = -cosHalfTheta;
	} else {
		qm[0] = qb[0];
		qm[1] = qb[1];
		qm[2] = qb[2];
		qm[3] = qb[3];
	}
	if ( Math.abs( cosHalfTheta ) >= 1.0 ) {
		qm[0] = qa[0];
		qm[1] = qa[1];
		qm[2] = qa[2];
		qm[3] = qa[3];
		return;
	}
	halfTheta = Math.acos( cosHalfTheta );
	sinHalfTheta = Math.sqrt( 1.0 - cosHalfTheta * cosHalfTheta );
	if ( Math.abs( sinHalfTheta ) < 0.001 ) {
		qm[0] = 0.5 * ( qa[0] + qm[0] );
		qm[1] = 0.5 * ( qa[1] + qm[1] );
		qm[2] = 0.5 * ( qa[2] + qm[2] );
		qm[3] = 0.5 * ( qa[3] + qm[3] );
		return;
	}
	ratioA = Math.sin( ( 1 - t ) * halfTheta ) / sinHalfTheta;
	ratioB = Math.sin( t * halfTheta ) / sinHalfTheta;
	qm[0] = qa[0] * ratioA + qm[0] * ratioB;
	qm[1] = qa[1] * ratioA + qm[1] * ratioB;
	qm[2] = qa[2] * ratioA + qm[2] * ratioB;
	qm[3] = qa[3] * ratioA + qm[3] * ratioB;
};

bezierp = function( x, interp, which ) {
	// which: 0=x, 1=y, 2=z, 3=rot
	return cubicBezier( x, interp[ which ] / 127, interp[ which + 4 ] / 127, interp[ which + 8 ] / 127, interp[ which + 12 ] / 127, 1 / 128 );
};

_q = [0,0,0,1];

// bone skinning animation
MMDSkin = function( mesh, animation ) { // extend Animation
	this.mesh = mesh;
	Animation.call( this, animation.targets, animation.duration );
	//this.update(0);
};
MMDSkin.prototype = Object.create( Animation.prototype );
MMDSkin.prototype.constructor = MMDSkin;

MMDSkin.prototype.onupdate = function( currKey, nextKey, ratio, idx ) {
	var bone = this.mesh.bones[ idx ],
		gbone = this.mesh.geometry.bones[ idx ],
		interp;
	//if (nextKey.interp) { // curr ではなく next 側を参照のこと。
		interp = nextKey.interp;
		// cubic bezier
		bone.position.x = gbone.pos[0] + currKey.pos[0] + ( nextKey.pos[0] - currKey.pos[0] ) * bezierp( ratio, interp, 0 );
		bone.position.y = gbone.pos[1] + currKey.pos[1] + ( nextKey.pos[1] - currKey.pos[1] ) * bezierp( ratio, interp, 1 );
		bone.position.z = gbone.pos[2] + currKey.pos[2] + ( nextKey.pos[2] - currKey.pos[2] ) * bezierp( ratio, interp, 2 );
		slerp( currKey.rot, nextKey.rot, _q, bezierp( ratio, interp, 3) );
		bone.quaternion.x = _q[0];
		bone.quaternion.y = _q[1];
		bone.quaternion.z = _q[2];
		bone.quaternion.w = _q[3];
	//} else {
	//	// linear
	//	bone.position.x = currKey.pos[0] + ( nextKey.pos[0] - currKey.pos[0] ) * ratio;
	//	bone.position.y = currKey.pos[1] + ( nextKey.pos[1] - currKey.pos[1] ) * ratio;
	//	bone.position.z = currKey.pos[2] + ( nextKey.pos[2] - currKey.pos[2] ) * ratio;
	//	slerp( currKey.rot, nextKey.rot, _q, ratio );
	//	bone.quaternion.x = _q[0];
	//	bone.quaternion.y = _q[1];
	//	bone.quaternion.z = _q[2];
	//	bone.quaternion.w = _q[3];
	//}
};

}()); // MMDSkin

(function() { // MMDAddTrans
// 「付与」による変形。

var dv, dq, _v, _v2, _q, _q2;

// delta transform
dv = new THREE.Vector3();
dq = new THREE.Quaternion();

// temporary
_v = new THREE.Vector3();
_v2 = new THREE.Vector3();
_q = new THREE.Quaternion();
_q2 = new THREE.Quaternion();

// additional transform
MMDAddTrans = function( pmx, mesh ) {
	var bones;
	this.mesh = mesh;
	bones = []; // 対象ボーン
	mesh.bones.forEach( function( v, i ) {
		var at, ref;
		v.pmxBone = pmx.bones[i]; // meshのboneからpmxのboneを参照できるようにする。
		at = v.pmxBone.additionalTransform;
		if ( at && at[0] >= 0 && at[1] !== 0 ) {
			// 付与で参照されるボーンには、変形量の差分を求めるためのプロパティを追加。
			ref = mesh.bones[ at[0] ];
			ref.basePosition = ref.position.clone();
			ref.baseQuaternion = ref.quaternion.clone();
			ref.baseSkinMatrix = ref.skinMatrix.clone();
			/* とりあえず考慮しない。
			if ( ( v.pmxBone.flags & 0x1000 ) !== 0 ) {
				// 物理演算後変形。
				return;
			} */
			bones.push( v );
		}
	});
	bones.sort( function( a, b ) {
		// 変形階層で昇順にソート。
		return a.pmxBone.deformHierachy - b.pmxBone.deformHierachy;
	});
	this.hasGlobal = bones.some( function( v ) { 
		// boneローカルな変形量ではなく、グローバルなskinMatrixを参照するかどうか。
		return ( (v.pmxBone.flags & 0x80) !== 0 );
	});
	this.bones = bones;
};
MMDAddTrans.prototype.update = function() {
	var mesh;
	mesh = this.mesh;
	if ( this.hasGlobal ) {
		mesh.updateMatrixWorld(); // bone の skinMatrix を更新させる。
	}
	this.bones.forEach( function( v ) {
		var at, ref, weight;
		at = v.pmxBone.additionalTransform;
		ref = mesh.bones[ at[0] ];
		// get delta transform
		// deltaPosition = position - basePosition
		// deltaQuaternion = quaternion - baseQuaternion
		if ( (v.pmxBone.flags & 0x80 ) !== 0 ) {
			// 未検証。
			_v.getPositionFromMatrix( ref.skinMatrix );
			_v2.getPositionFromMatrix( ref.baseSkinMatrix );
			dv.subVectors( _v, _v2 );
			_q.setFromRotationMatrix( ref.skinMatrix );
			_q2.setFromRotationMatrix( ref.baseSkinMatrix );
			dq.multiplyQuaternions( _q2.conjugate() , _q );
		} else {
			dv.subVectors( ref.position, ref.basePosition );
			//dq.multiplyQuaternions( _q.copy( ref.baseQuaternion ).conjugate() , ref.quaternion );
			dq.copy( ref.quaternion ); // 実際には baseQuaternion = (0,0,0,1) なので簡略。
		}
		weight = at[1];
		if ( ( v.pmxBone.flags & 0x100) !== 0 ) {
			// 回転付与。
			_q.set(0,0,0,1);
			if ( weight >= 0) {
				// 順回転。
				_q.slerp( dq, weight );
			} else {
				// 逆回転。
				_q.slerp( dq.conjugate(), -weight );
			}
			v.quaternion.multiplyQuaternions( v.quaternion, _q );
		}
		if ( ( v.pmxBone.flags & 0x200) !== 0 ) {
			// 移動付与。
			v.position.addVectors( v.position, dv.multiplyScalar(weight) );
		}
	});
};

}()); // MMDAddTrans

(function() { // MMDCamera

var bezierp, _v;

bezierp = function( x, interp, which ) {
	// which: 0=x, 1=y, 2=z, 3=rot, 4=distance, 5=fov
	which *= 4;
	return cubicBezier( x, interp[ which ] / 127, interp[ which + 2 ] / 127, interp[ which + 1 ] / 127, interp[ which + 3 ] / 127, 1 / 128 );
};

// temporary
_v = new THREE.Vector3();

// camera motion
MMDCamera = function( persepectiveCamera, animation ) { // extend Animation
	// ※平行投影(orthograph)カメラは未対応。
	if ( !(persepectiveCamera instanceof THREE.PerspectiveCamera) ) {
		console.error('not PerspectiveCamera');
		return;
	}
	this.persepectiveCamera = persepectiveCamera;
	Animation.call( this, animation, animation.duration );
	this.minKeyDelta = MMD.minKeyDelta;
	this.offset = new THREE.Vector3(); // モデルによる身長差とかに対応。
	this.target = new THREE.Vector3(); // for trackball control
	//this.update(0);
};
MMDCamera.prototype = Object.create( Animation.prototype );
MMDCamera.prototype.constructor = MMDCamera;

MMDCamera.prototype.play = function( loop ) {
	Animation.prototype.play.call( this, loop );
	// matrix の更新は自前でやるので autoUpdate は無効にする。
	// そのため trackball control とかで影響でるので要注意！
	this.persepectiveCamera.rotationAutoUpdate = false;
	this.persepectiveCamera.matrixAutoUpdate = false;
};

MMDCamera.prototype.pause = function() {
	Animation.prototype.pause.call( this );
	this.persepectiveCamera.rotationAutoUpdate = true;
	this.persepectiveCamera.matrixAutoUpdate = true;
};

MMDCamera.prototype.onupdate = function( currKey, nextKey, ratio ) {
	var persepectiveCamera = this.persepectiveCamera,
		interp = nextKey.interp,
		t, pos, rot, distance, prevFov, mtx;
	pos = persepectiveCamera.position;
	pos.x = currKey.target[0] + ( nextKey.target[0] - currKey.target[0] ) * bezierp( ratio, interp, 0 );
	pos.y = currKey.target[1] + ( nextKey.target[1] - currKey.target[1] ) * bezierp( ratio, interp, 1 );
	pos.z = currKey.target[2] + ( nextKey.target[2] - currKey.target[2] ) * bezierp( ratio, interp, 2 );
	pos.addVectors( pos, this.offset );
	this.target.copy( pos );
	t = bezierp( ratio, interp, 3 );
	rot = persepectiveCamera.rotation;
	rot.x = currKey.rot[0] + ( nextKey.rot[0] - currKey.rot[0] ) * t;
	rot.y = currKey.rot[1] + ( nextKey.rot[1] - currKey.rot[1] ) * t;
	rot.z = currKey.rot[2] + ( nextKey.rot[2] - currKey.rot[2] ) * t;
	distance = currKey.distance + ( nextKey.distance - currKey.distance ) * bezierp( ratio, interp, 4 );
	prevFov = persepectiveCamera.fov;
	persepectiveCamera.fov = currKey.fov + ( nextKey.fov - currKey.fov ) * bezierp( ratio, interp, 5 );
	if ( persepectiveCamera.fov !== prevFov ) {
		persepectiveCamera.updateProjectionMatrix();
	}
	mtx = persepectiveCamera.matrix;
	//mtx.identity();
	mtx.makeRotationFromEuler( rot );
	pos.add( _v.getColumnFromMatrix(2,mtx).multiplyScalar( distance ) );
	mtx.setPosition( pos );
	persepectiveCamera.up.copy( _v.getColumnFromMatrix(1,mtx) ); // for trackball control
	persepectiveCamera.matrixWorldNeedsUpdate = true; // 自前でやったのでワールド更新要求も自前で出す。
};

}()); // MMDCamera

// light motion
MMDLight = function( directionalLight, animation ) { // extend Animation
	if ( !(directionalLight instanceof THREE.DirectionalLight) ) {
		console.error('not DirectionalLight');
		return;
	}
	this.directionalLight = directionalLight;
	Animation.call( this, animation, animation.duration );
	this.minKeyDelta = MMD.minKeyDelta;
	//this.update(0);
};
MMDLight.prototype = Object.create( Animation.prototype );
MMDLight.prototype.constructor = MMDLight;

MMDLight.prototype.onupdate = function( currKey, nextKey, ratio ) {
	var directionalLight = this.directionalLight,
		color = directionalLight.color,
		position = directionalLight.position,
		target = directionalLight.target.position;
	color.r = currKey.color[0] + ( nextKey.color[0] - currKey.color[0] ) * ratio;
	color.g = currKey.color[1] + ( nextKey.color[1] - currKey.color[1] ) * ratio;
	color.b = currKey.color[2] + ( nextKey.color[2] - currKey.color[2] ) * ratio;
	position.x = 0;
	position.y = 0;
	position.z = 0;
	target.x = currKey.dir[0] + ( nextKey.dir[0] - currKey.dir[0] ) * ratio;
	target.y = currKey.dir[1] + ( nextKey.dir[1] - currKey.dir[1] ) * ratio;
	target.z = currKey.dir[2] + ( nextKey.dir[2] - currKey.dir[2] ) * ratio;
};

(function() { // MODEL

var skinnedMesh_updateMatrixWorld, hasAdditionalTransform;

skinnedMesh_updateMatrixWorld = function( force ) {
	var i, l, child;
	this.matrixAutoUpdate && this.updateMatrix();
	if ( this.matrixWorldNeedsUpdate || force ) {
		if ( this.parent ) {
			this.matrixWorld.multiplyMatrices( this.parent.matrixWorld, this.matrix );
		} else {
			this.matrixWorld.copy( this.matrix );
		}
		this.matrixWorldNeedsUpdate = false;
		force = true;
	}
	for ( i = 0, l = this.children.length; i < l; i ++ ) {
		child = this.children[ i ];
		if ( child instanceof THREE.Bone ) {
			child.update( this.identityMatrix, false );
		} else {
			child.updateMatrixWorld( true );
		}
	}
};

hasAdditionalTransform = function( pmx ) {
	return pmx.bones.some( function( v ) {
		return !!v.additionalTransform; //return ( ( v.flags & 0x300) !== 0 );
	});
};

Model = function( pmx, vmd ) {
	this.init( pmx, vmd );
};
Model.prototype.init = function( pmx, vmd ) {
	this.pmx = pmx;
	this.vmd = vmd;
	this.ik = null;
	this.physi = null;
	this.skin = null;
	this.morph = null;
	this.addTrans = null;
	this.mesh = null; // THREE.SkinnedMesh
	this.simulateCallback = null;
	this.boundingCenterOffset = null;
	this._onmotionended = null;
};
Model.prototype.load = function( modelUrl, motionUrl, onload ) {
	var that;
	that = this;
	( new PMX() ).load( modelUrl, function( pmx ) {
		if ( motionUrl ) {
			( new VMD() ).load( motionUrl, function( vmd ) {
				success( pmx, vmd );
			});
		} else {
			success( pmx );
		}
	});

	function success( pmx, vmd ) {
		Model.call( that, pmx, vmd );
		onload( that );
	}
};
Model.prototype.create = function( param, oncreate ) {
	var that;
	that = this;
	if ( this.pmx ) {
		this.pmx.createMesh( param, function( mesh ) {
			var animation;
			that.mesh = mesh;
			mesh.identityMatrix = null; // 少し速くなるかも。
			mesh.useQuaternion = true;
			if ( param.position ) {
				mesh.position.copy( param.position );
			}
			if ( param.rotation ) {
				mesh.rotation.copy( param.rotation );
				mesh.useQuaternion = false;
			}
			if ( param.quaternion ) {
				mesh.quaternion.copy( param.quaternion );
				mesh.useQuaternion = true;
			}
			that.boundingCenterOffset = mesh.geometry.boundingSphere.center.clone().sub( mesh.bones[0].position ); // offset from skeleton center
			if ( mesh.geometry.MMDIKs.length ) {
				that.ik = new MMDIK( mesh );
			} else {
				that.ik = null;
			}
			if ( mesh.geometry.MMDrigids.length ) {
				that.physi = new MMDPhysi( mesh );
			} else {
				that.physi = null;
			}
			if ( that.vmd ) {
				animation = that.vmd.generateSkinAnimation( that.pmx );
				if ( animation ) {
					that.skin = new MMDSkin( mesh, animation );
					that.skin.onended = function( skin ) {
						if ( skin.loop ) {
							if ( that.physi ) {
								that.physi.reset();
							}
						}
						that._onmotionended = that.onmotionended; // mark
					};
					if ( that.physi ) {
						// 物理演算をやる場合は、
						// boneMatrices の更新は自前でやるので updateMatrixWorld を override する。
						// override しなくても動作するが、無駄な計算を減らすため。
						mesh.updateMatrixWorld = skinnedMesh_updateMatrixWorld;
					}
				} else {
					that.skin = null;
				}
				animation = that.vmd.generateMorphAnimation( that.pmx );
				if ( animation  ) {
					that.morph = new MMDMorph( mesh, animation );
				} else {
					that.morph = null;
				}
			}
			if ( hasAdditionalTransform( that.pmx ) ) {
				that.addTrans = new MMDAddTrans( that.pmx, mesh );
			} else {
				that.addTrans = null;
			}
			oncreate( that );
		});
	}
};
Model.prototype.resetBones = function() {
	var mesh, bones;
	mesh = this.mesh;
	if ( mesh ) {
		bones = mesh.bones;
		mesh.geometry.bones.forEach( function( v, i ) {
			var bone;
			bone = bones[i];
			bone.position.set( v.pos[0], v.pos[1], v.pos[2] );
			bone.quaternion.set( v.rotq[0], v.rotq[1], v.rotq[2], v.rotq[3] );
		});
		/* if ( mesh.morphTargetInfluences ) {
			// reset morphTargetInfluences
			mesh.morphTargetInfluences.forEach( function( v, i, a ) {
				a[i] = 0;
			});
		} */
	}
};
Model.prototype.resetMotion = function() {
	this.resetBones();
	if ( this.morph ) {
		this.morph.reset();
	}
	if ( this.skin ) {
		this.skin.reset();
	}
	if ( this.physi ) {
		this.physi.reset();
	}
};
Model.prototype.updateMotion = function( dt, force ) {
	this.resetBones();
	if ( this.morph ) {
		this.morph.update( dt, force );
	}
	if ( this.skin ) {
		this.skin.update( dt, force );
		this.mesh.geometry.boundingSphere.center.addVectors( this.mesh.bones[0].position, this.boundingCenterOffset );
	}
	if ( this.ik ) {
		this.ik.update();
	}
	if ( this.addTrans ) {
		this.addTrans.update();
	}
	this.checkCallback();
};
Model.prototype.seekMotion = function( time, forceUpdate ) {
	this.resetBones();
	if ( this.morph ) {
		this.morph.seek( time, forceUpdate );
	}
	if ( this.skin ) {
		this.skin.seek( time, forceUpdate );
		this.mesh.geometry.boundingSphere.center.addVectors( this.mesh.bones[0].position, this.boundingCenterOffset );
	}
	if ( this.ik ) {
		this.ik.update();
	}
	if ( this.addTrans ) {
		this.addTrans.update();
	}
	this.checkCallback();
};
Model.prototype.playMotion = function( loop ) {
	if ( this.morph ) {
		this.morph.play( loop );
	}
	if ( this.skin ) {
		this.skin.play( loop );
	}
};
Model.prototype.pauseMotion = function() {
	if ( this.morph ) {
		this.morph.pause();
	}
	if ( this.skin ) {
		this.skin.pause();
	}
};
Model.prototype.preSimulate = function() {
	if ( this.physi ) {
		this.physi.preSimulate();
	}
};
Model.prototype.postSimulate = function() {
	if ( this.physi ) {
		this.physi.postSimulate();
	}
};
Model.prototype.dispose = function() {
	if ( this.physi ) {
		this.physi.dispose();
	}
	if ( this.mesh ) {
		this.mesh.dispose();
	}
	this.init();
};
Model.prototype.checkCallback = function() {
	if ( this._onmotionended ) {
		this._onmotionended( this );
		this._onmotionended = null;
	}
};

}()); // MODEL

(function() { // MMD

var models, cameraMotion, lightMotion,
	motionPlaying, motionLoop, motionDelta, motionTime, tickPhysics, updatePhysicsDuringPause,
	targetRenderer, plugin,
	onended, checkCallback;

models = [];
motionPlaying = false;
motionLoop = false;
motionDelta = 0;
motionTime = 0;
tickPhysics = false;
updatePhysicsDuringPause = true; // モーション開始前に物理演算を更新させることで初期の安定を試みる。数秒間やるのが望ましいかも。
plugin = {
	render: function( _scene ) {
		var delta;
		if ( !MMD.targetScene || MMD.targetScene === _scene ) {
			if ( MMD.motionPlaying || tickPhysics || updatePhysicsDuringPause ) {
				tickPhysics = false;
				delta = motionDelta;
			} else {
				delta = 0;
			}
			MMD.simulate( delta );
		}
	}
};
checkCallback = function() {
	if ( onended ) {
		onended();
		onended = undefined;
	}
};

MMD = {
	loadAssets: function( assets, urlBase, onload ) {
		// - input
		// expr1: asstes = [ { url:'aaa.ext', type:'pmx' }, { url:'bbb.vmd' } ];
		// expr2: asstes = { item1: { url:'aaa.pmx' }, item2:{ url:'bbb.vmd' } };
		// - output
		// .. { url:'aaa.pmx', obj:loadedObject } ..
		var monitor, p;
		urlBase = urlBase || '';
		monitor = new EventMonitor();
		monitor.add( function() {
			onload( assets );
		});
		if ( assets instanceof Array ) {
			assets.forEach( parse );
		} else {
			for ( p in assets ) {
				if ( assets.hasOwnProperty( p ) ) {
					parse( assets[ p ] );
				}
			}
		}
		monitor.del();

		function parse( v ) {
			var url, type, obj;
			url = v.url;
			if ( url ) {
				type = v.type;
				if ( !type ) {
					type = Misc.extractPathExt( url );
				}
				type = type.toLowerCase();
				switch( type ) {
				case 'pmx':
					obj = new PMX();
					break;
				case 'vmd':
					obj = new VMD();
					break;
				default:
					console.warn( 'not supported asset type : ' + type );
					return;
				}
				monitor.add();
				obj.load( urlBase + url, function( obj ) {
					v.obj = obj;
					monitor.del();
				});
			}
		}
	},
	addModel: function( model ) {
		models.push( model );
	},
	removeModel: function( model ) {
		var idx;
		idx = models.indexOf( model );
		if ( idx >= 0 ) {
			models.splice( idx, 1 );
		}
	},
	getModels: function() {
		return models;
	},
	setupCameraMotion: function( vmd, camera ) {
		var animation;
		animation = vmd.generateCameraAnimation();
		if ( animation ) {
			cameraMotion = new MMDCamera( camera, animation );
		} else {
			cameraMotion = undefined;
		}
	},
	getCameraMotion: function() {
		return cameraMotion;
	},
	setupLightMotion: function( vmd, light ) {
		var animation;
		animation = vmd.generateLightAnimation();
		if ( animation ) {
			lightMotion = new MMDLight( light, animation );
		} else {
			lightMotion = undefined;
		}
	},
	getLightMotion: function() {
		return lightMotion;
	},
	adjustMotionDuration: function() {
		var duration = 0;

		// pass 1
		if ( cameraMotion ) {
			duration = Math.max( duration, cameraMotion.duration );
		}
		if ( lightMotion ) {
			duration = Math.max( duration, lightMotion.duration );
		}
		models.forEach( function( v ) {
			if ( v.skin ) {
				duration = Math.max( duration, v.skin.duration );
			}
			if ( v.morph ) {
				duration = Math.max( duration, v.morph.duration );
			}
		});

		// pass 2
		if ( cameraMotion ) {
			cameraMotion.adjustDuration( duration );
		}
		if ( lightMotion ) {
			lightMotion.adjustDuration( duration );
		}
		models.forEach( function( v ) {
			if ( v.skin ) {
				v.skin.adjustDuration( duration );
			}
			if ( v.morph ) {
				v.morph.adjustDuration( duration );
			}
		});
	},
	resetMotion: function() {
		if ( cameraMotion ) {
			cameraMotion.reset();
		}
		if ( lightMotion ) {
			lightMotion.reset();
		}
		models.forEach( function( v ) {
			v.resetMotion();
		});
		motionTime = 0;
	},
	updateMotion: function( dt, force ) {
		// この関数はデルタ時間を更新する機能も兼ねているので、状況に関わらずこれを毎tick呼ぶこと！
		motionDelta = dt; // 最新のdeltaは常に覚えておく。
		if ( !force && !motionPlaying ) {
			return;
		}
		if ( cameraMotion ) {
			cameraMotion.update( dt, force );
		}
		if ( lightMotion ) {
			lightMotion.update( dt, force );
		}
		models.forEach( function( v ) {
			v.updateMotion( dt, force );
		});
		checkCallback();
		motionTime += dt;
	},
	seekMotion: function( time, forceUpdate ) {
		if ( !forceUpdate && !motionPlaying ) {
			return;
		}
		if ( cameraMotion ) {
			cameraMotion.seek( time, forceUpdate );
		}
		if ( lightMotion ) {
			lightMotion.seek( time, forceUpdate );
		}
		models.forEach( function( v ) {
			v.seekMotion( time, forceUpdate );
		});
		checkCallback();
		tickPhysics = true; // seekした時は物理演算を更新させる。
		motionTime = time;
	},
	playMotion: function( loop ) {
		var that;
		that = this;
		if ( loop !== undefined ) {
			motionLoop = loop;
		}
		if ( cameraMotion ) {
			cameraMotion.play( motionLoop );
		}
		if ( lightMotion ) {
			lightMotion.play( motionLoop );
		}
		models.forEach( function( v ) {
			v.playMotion( motionLoop );
		});
		if ( models.length > 0 ) {
			// 先頭で代表させる。
			models[0].onmotionended = function( model ) {
				// skinアニメーションの完了時またはループ時に呼ばれる。
				//if ( model.skin.loop ) {
				if ( motionLoop ) {
					motionTime = 0;
				} else {
					that.pauseMotion();
				}
				onended = MMD.onmotionended; // mark
			};
		}
		motionPlaying = true;
	},
	pauseMotion: function( updatePhysics ) {
		updatePhysicsDuringPause = updatePhysics; // ポーズ中に物理演算を更新するかどうか。
		if ( cameraMotion ) {
			cameraMotion.pause();
		}
		if ( lightMotion ) {
			lightMotion.pause();
		}
		models.forEach( function( v ) {
			v.pauseMotion();
		});
		motionPlaying = false;
	},
	adjustCameraOffset: function( param ) { // カメラの位置を調整。
		var model, offset, size;
		if ( cameraMotion ) {
			if ( param ) {
				model = param.model;
				offset = param.offset;
			} else {
				if ( models.length > 0 ) {
					model = models[0]; // 最初のモデルを対象にする。
				}
			}
			if ( model ) {
				// モデルの大きさに応じて調整。
				size = model.mesh.geometry.boundingBox.size();
			}
			cameraMotion.offset.set(0,0,0);
			if ( size ) {
				cameraMotion.offset.y = size.y - 20; // 標準ミクさんの高さは約20。
			}
			if ( offset ) {
				cameraMotion.offset.addVectors( cameraMotion.offset, offset );
			}
		}
	},
	getWorld: function() {
		return btWorld;
	},
	setGravity: function( x,y,z ) {
		btWorld.setGravity( tmpBV( x,y,z ) );
	},
	simulate: function( timeStep, maxSubSteps ) {
		// ワールド行列計算後かつレンダリングする前にこれを呼ぶこと。
		if ( models.length === 0 ) {
			return;
		}
		if ( timeStep <= 0 ) {
			// pause
			//models.forEach( function( v ) {
			//	v.postSimulate();
			//});
		} else {
			//if ( !timeStep ) {
			//	if ( lastSimulateTime ) {
			//		timeStep = 0;
			//		while ( timeStep + lastSimulateDuration <= fixedTimeStep ) {
			//			timeStep = ( Date.now() - lastSimulateTime ) / 1000; // time since last simulation
			//		}
			//	} else {
			//		timeStep = fixedTimeStep; // handle first frame
			//	}
			//} else {
				if ( timeStep < fixedTimeStep ) {
					timeStep = fixedTimeStep;
				}
			//}
			maxSubSteps = maxSubSteps || Math.ceil( timeStep / fixedTimeStep ); // If maxSubSteps is not defined, keep the simulation fully up to date
			//lastSimulateDuration = Date.now();

			models.forEach( function( v ) {
				v.preSimulate();
			});
			btWorld.stepSimulation( timeStep, maxSubSteps, fixedTimeStep );
			//btWorld.clearForces();
			models.forEach( function( v ) {
				v.postSimulate();
			});

			//lastSimulateDuration = ( Date.now() - lastSimulateDuration ) / 1000;
			//lastSimulateTime = Date.now();
		}
		models.forEach( function( v ) {
			if ( v.simulateCallback ) {
				v.simulateCallback();
			}
		});
	},
	init: function( renderer, scene ) {
		MMD.targetScene = scene;
		MMD.targetRenderer = renderer;
	},
	targetScene: null,
	get targetRenderer() { return targetRenderer; },
	set targetRenderer( renderer ) {
		if ( targetRenderer !== renderer ) {
			targetRenderer = renderer;
			if ( renderer.renderPluginsPre.indexOf( plugin ) === -1 ) {
				// 物理演算更新はプリレンダーなプラグインとして登録。
				// 一番目に実行されるようにリストの先頭へ追加すること！
				renderer.renderPluginsPre.unshift( plugin );
			}
		}
	},
	get motionPlaying() { return motionPlaying; },
	get motionLoop() { return motionLoop; },
	get motionDelta() { return motionDelta; },
	get motionTime() { return motionTime; },
	onmotionended: null,
	minKeyDelta: 1/30 + 1/60, // カメラとライトモーション向け。誤差対策(+epsilon)
	STOP_ERP: 0.475, // 0.45,
	PMX: PMX,
	VMD: VMD,
	Model: Model
};

}()); // MMD

THREE.MMD = MMD;

// 試験的。
THREE.Mesh.prototype.dispose = function() { // delete webgl objects
	if ( this.material.materials ) {
		this.material.materials.forEach( function( v ) {
			disposeTextures( v );
			v.dispose();
		});
	} else {
		disposeTextures( this.material );
		this.material.dispose();
	}
	this.geometry.dispose();

	function disposeTextures( material ) {
		var o, p;
		for ( p in material ) {
			o = material[p];
			if ( o instanceof THREE.Texture ) {
				o.dispose();
				//console.log(p);
			}
		}
	}
};

MMD.setGravity( 0, -9.8*10, 0 );

}());
