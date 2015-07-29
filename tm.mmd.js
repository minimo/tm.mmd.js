(function() {
    tm.asset = tm.asset || {};

    tm.define("tm.asset.MMD", {
        superClass: "tm.event.EventDispatcher",

        init: function(path) {
            this.mesh = null;
            this.superInit();
            this.load(path);
        },

        load: function(path) {
            modelPath = path[0];
            motionPath = path[1];

            var onProgress = function(xhr) {};
            var onError = function(xhr) {};

            var that = this;
            var loader = new THREE.MMDLoader();
            loader.load( modelPath, motionPath, function (object) {
                var mesh = that.mesh = object;
                mesh.position.y = -10;

                that.animation = new THREE.Animation(mesh, mesh.geometry.animation);
                that.animation.play();

                that.morphAnimation = new THREE.MorphAnimation2(mesh, mesh.geometry.morphAnimation);
                that.morphAnimation.play();

                that.ikSolver = new tm.hybrid.mmd.CCDIKSolver(mesh);
                that.flare("load");
            }, onProgress, onError);
        }
    });

    //ローダーに拡張子登録
    tm.asset.Loader.register("mmd", function(path) {
        return tm.asset.MMD(path);
    });

    tm.hybrid.createMeshFromMMD = function(pmdName, vmdName) {
        var asset = tm.asset.Manager.get(pmdName);
        var pmd = asset.pmd;
        if (!pmd) {
            console.error("アセット'{0}'がないよ".format(pmdName));
            return null;
        }
        if (!(asset instanceof tm.asset.PMD)) {
            console.error("アセット'{0}'はPMDじゃないよ".format(pmdName));
            return null;
        }

        var asset = tm.asset.Manager.get(vmdName);
        var vmd = asset.vmd;
        if (!vmd) {
            console.error("アセット'{0}'がないよ".format(vmdName));
            return null;
        }
        if (!(asset instanceof tm.asset.VMD)) {
            console.error("アセット'{0}'はVMDじゃないよ".format(vmdName));
            return null;
        }

        var geometry = new THREE.Geometry();
        var material = new THREE.MeshFaceMaterial();

        //左手系から右手系への変改
        var convertVector = function(v) {v[2] = -v[2];};
        var convertQuaternion = function (q) {q[0] = -q[0]; q[1] = -q[1];};
        var convertIndexOrder = function (p) {var tmp = p[2]; p[2] = p[ 0 ]; p[0] = tmp;};
        for (var i = 0; i < pmd.metadata.vertexCount; i++) {
            convertVector(pmd.vertices[i].position);
            convertVector(pmd.vertices[i].normal);
        }
        for (var i = 0; i < pmd.metadata.faceCount; i++) {
            convertIndexOrder(pmd.faces[i].indices);
        }
        for (var i = 0; i < pmd.metadata.boneCount; i++) {
            convertVector(pmd.bones[i].position);
        }
        for (var i = 0; i < pmd.metadata.morphCount; i++) {
            var m = pmd.morphs[i];
            for(var j = 0; j < m.vertexCount; j++) {
                convertVector(m.vertices[j].position);
            }
        }
        for (var i = 0; i < vmd.metadata.motionCount; i++) {
            convertVector(vmd.motions[i].position);
            convertQuaternion(vmd.motions[i].rotation);
        }

        //頂点情報構築
        for (var i = 0; i < pmd.metadata.vertexCount; i++) {
            geometry.vertices.push(
                new THREE.Vector3(
                    pmd.vertices[i].position[0],
                    pmd.vertices[i].position[1],
                    pmd.vertices[i].position[2]
                )
            );
            geometry.skinIndices.push(
                new THREE.Vector4(
                    pmd.vertices[i].skinIndices[0],
                    pmd.vertices[i].skinIndices[1],
                    0.0, 0.0
                )
            );
            geometry.skinWeights.push(
                new THREE.Vector4(
                    pmd.vertices[i].skinWeight/100,
                    (100-pmd.vertices[i].skinWeight)/100,
                    0.0, 0.0
                )
            );
        }

        //フェース情報構築
        for (var i = 0; i < pmd.metadata.faceCount; i++) {
            geometry.faces.push(
                new THREE.Face3(
                    pmd.faces[i].indices[0],
                    pmd.faces[i].indices[1],
                    pmd.faces[i].indices[2]
                )
            );
            for (var j = 0; j < 3; j++) {
                geometry.faces[i].vertexNormals[j] = new THREE.Vector3(
                    pmd.vertices[pmd.faces[i].indices[j]].normal[0],
                    pmd.vertices[pmd.faces[i].indices[j]].normal[1],
                    pmd.vertices[pmd.faces[i].indices[j]].normal[2]
                );
            }
        }

        //ボーン情報構築
        var bones = [];
        for　(var i = 0; i < pmd.metadata.boneCount; i++) {
            var b = pmd.bones[i];
            var bone = {
                parent: (b.parentIndex === 0xFFFF )? -1: b.parentIndex,
                name: b.name,
                pos: [b.position[0], b.position[1], b.position[2]],
                rotq: [0, 0, 0, 1],
                scl: [1, 1, 1]
            };
            if (bone.parent !== -1) {
                bone.pos[0] -= pmd.bones[bone.parent].position[0];
                bone.pos[1] -= pmd.bones[bone.parent].position[1];
                bone.pos[2] -= pmd.bones[bone.parent].position[2];
            }
            bones.push(bone);
        }
        geometry.bones = bones;

        //モーフィングデータ構築
        for (var i = 0; i < pmd.metadata.morphCount; i++) {
            var m = pmd.morphs[i];
            var params = {};
            params.name = m.name;
            params.vertices = [];
            for(var j = 0; j < pmd.metadata.vertexCount; j++) {
                params.vertices[j] = new THREE.Vector3(
                    geometry.vertices[j].x,
                    geometry.vertices[j].y,
                    geometry.vertices[j].z);
            }
            if (i !== 0) {
                for(var j = 0; j < m.vertexCount; j++) {
                    var v = m.vertices[j];
                    var index = pmd.morphs[0].vertices[v.index].index;
                    params.vertices[index].x += v.position[0];
                    params.vertices[index].y += v.position[1];
                    params.vertices[index].z += v.position[2];
                }
            }
            geometry.morphTargets.push(params);
        }

        //マテリアル構築
        var offset = 0;
        var materialParams = [];
        for (var i = 1; i < pmd.metadata.materialCount; i++) {
            var dummy = [];
            geometry.faceVertexUvs.push(dummy);
        }
        for (var i = 0; i < pmd.metadata.materialCount; i++) {
            var m = pmd.materials[i];
            var params = {};
            for (var j = 0; j < m.faceCount; j++) {
                geometry.faces[offset].materialIndex = i;
                var uvs = [];
                for (var k = 0; k < 3; k++) {
                    var v = pmd.vertices[pmd.faces[offset].indices[k]];
                    uvs.push(new THREE.Vector2(v.uv[0], v.uv[1]));
                }
                geometry.faceVertexUvs[0].push(uvs);
                offset++;
            }

            params.shading = 'phong';
            params.colorDiffuse = [m.diffuse[0], m.diffuse[1], m.diffuse[2]];
            params.opacity = m.diffuse[3];
            params.colorSpecular = [m.specular[0], m.specular[1], m.specular[2]];
            params.specularCoef = m.shiness;

            // temporal workaround
            // TODO: implement correctly
            params.doubleSided = true;

            if (m.fileName) {
                var fileName = m.fileName;

                // temporal workaround, use .png instead of .tga
                // TODO: tga file support
                if (fileName.indexOf('.tga')) fileName = fileName.replace('.tga', '.png');

                // temporal workaround, disable sphere mapping so far
                // TODO: sphere mapping support
                var index;
                if ((index = fileName.lastIndexOf('*')) >= 0) fileName = fileName.slice(index+1);
                if ((index = fileName.lastIndexOf('+')) >= 0) fileName = fileName.slice(index+1);
                params.mapDiffuse = fileName;
            } else {
                params.colorEmissive = [m.emissive[0], m.emissive[1], m.emissive[2]];
            }
            materialParams.push(params);
        }

        var materials = scope.initMaterials(materialParams, texturePath);
        for (var i = 0; i < materials.length; i++) {
            var m = materials[i];
            if (m.map) m.map.flipY = false;
            m.skinning = true;
            m.morphTargets = true;
            material.materials.push(m);
        }

        //モーション構築
        var orderedMotions = [];
        var boneTable = {};
        for (var i = 0; i < pmd.metadata.boneCount; i++) {
            var b = pmd.bones[i];
            boneTable[b.name] = i;
            orderedMotions[i] = [];
        }
        for (var i = 0; i < vmd.motions.length; i++) {
            var m = vmd.motions[i];
            var num = boneTable[m.boneName];
            if (num === undefined) continue;
            orderedMotions[num].push(m);
        }
        for (var i = 0; i < orderedMotions.length; i++) {
            orderedMotions[i].sort(function (a, b) {
                return a.frameNum - b.frameNum;
            });
        }
        var animation = {
            name: 'Action',
            fps: 30,
            length: 0.0,
            hierarchy: []
        };
        for (var i = 0; i < geometry.bones.length; i++) {
            animation.hierarchy.push({
                parent: geometry.bones[i].parent,
                keys: []
            });

        }

        var maxTime = 0.0;
        for (var i = 0; i < orderedMotions.length; i++) {
            var array = orderedMotions[i];
            for (var j = 0; j < array.length; j++) {
                var t = array[j].frameNum/30;
                var p = array[j].position;
                var r = array[j].rotation;
                animation.hierarchy[i].keys.push({
                    time: t,
                    pos: [
                        geometry.bones[i].pos[0] + p[0],
                        geometry.bones[i].pos[1] + p[1],
                        geometry.bones[i].pos[2] + p[2]
                    ],
                    rot: [r[0], r[1], r[2], r[3]],
                    scl: [1, 1, 1]
                });
                if (t > maxTime) maxTime = t;
            }
        }

        // add 2 secs as afterglow
        maxTime += 2.0;
        animation.length = maxTime;
        for (var i = 0; i < orderedMotions.length; i++) {
            var keys = animation.hierarchy[i].keys;
            if (keys.length === 0) {
                keys.push({
                    time: 0.0,
                    pos: [
                        geometry.bones[i].pos[0],
                        geometry.bones[i].pos[1],
                        geometry.bones[i].pos[2]
                    ],
                    rot: [0, 0, 0, 1],
                    scl: [1, 1, 1]
                });
            }
            var k = keys[0];
            if (k.time !== 0.0) {
                keys.unshift({
                    time: 0.0,
                    pos: [k.pos[0], k.pos[1], k.pos[2]],
                    rot: [k.rot[0], k.rot[1], k.rot[2], k.rot[3]],
                    scl: [1, 1, 1]
                });
            }
            k = keys[keys.length-1];
            if (k.time < maxTime) {
                keys.push({
                    time: maxTime,
                    pos: [k.pos[0], k.pos[1], k.pos[2]],
                    rot: [k.rot[0], k.rot[1], k.rot[2], k.rot[3]],
                    scl: [1, 1, 1]
                });
            }
        }
        geometry.animation = animation;

        //モーフィングアニメーション構築
        var orderedMorphs = [];
		var morphTable = {}
		for (var i = 0; i < pmd.metadata.morphCount; i++) {
			var m = pmd.morphs[i];
			morphTable[m.name] = i;
			orderedMorphs[i] = [];
		}
		for (var i = 0; i < vmd.morphs.length; i++) {
    		var m = vmd.morphs[i];
			var num = morphTable[ m.morphName ];
			if ( num === undefined )continue;
			orderedMorphs[num].push( m );
		}
		for (var i = 0; i < orderedMorphs.length; i++) {
			orderedMorphs[i].sort(function (a, b) {
				return a.frameNum - b.frameNum;
			});
		}
		var morphAnimation = {
			fps: 30,
			length: 0.0,
			hierarchy: []
		};
		for (var i = 0; i < pmd.metadata.morphCount; i++) {
			morphAnimation.hierarchy.push({keys: []});
		}
		var maxTime = 0.0;
		for (var i = 0; i < orderedMorphs.length; i++) {
			var array = orderedMorphs[i];
			for (var j = 0; j < array.length; j++) {
                var t = array[j].frameNum / 30;
                var w = array[j].weight;
				morphAnimation.hierarchy[i].keys.push({time: t, weight: w});
				if ( t > maxTime ) maxTime = t;
			}
		}

		// add 2 secs as afterglow
		maxTime += 2.0;

        // use animation's length if exists. animation is master.
        maxTime = (geometry.animation !== undefined && geometry.animation.length > 0.0 )? geometry.animation.length: maxTime;
        morphAnimation.length = maxTime;
		for (var i = 0; i < orderedMorphs.length; i++) {
			var keys = morphAnimation.hierarchy[i].keys;
			if (keys.length === 0) keys.push({time: 0.0, weight: 0.0});

			var k = keys[0];
			if ( k.time !== 0.0 ) keys.unshift({time: 0.0, weight: k.weight});

			k = keys[keys.length-1];
			if (k.time < maxTime) keys.push({time: maxTime, weight: k.weight});
		}
		geometry.morphAnimation = morphAnimation;

        geometry.computeFaceNormals();
        geometry.verticesNeedUpdate = true;
        geometry.normalsNeedUpdate = true;
        geometry.uvsNeedUpdate = true;
        var mesh = new THREE.SkinnedMesh(geometry, material);
        mesh.position.y = -10;
        var hybridMesh = tm.hybrid.MMDMesh(mesh);

        hybridMesh._animation = new THREE.Animation(mesh, mesh.geometry.animation);
        hybridMesh._animation.play();

        hybridMesh._morphAnimation = new THREE.MorphAnimation2(mesh, mesh.geometry.morphAnimation);
        hybridMesh._morphAnimation.play();

        hybridMesh._ikSolver = new tm.hybrid.mmd.CCDIKSolver(mesh);
        hybridMesh.on('enterframe', function(e) {
            this._ikSolver.update();
        }.bind(hybridMesh));

        return hybridMesh;
    }

    //CCD法によるIK解決
    tm.define("tm.hybrid.mmd.CCDIKSolver", {
        init: function(mesh) {
            this.mesh = mesh;
        },
        update: function() {
            var effectorVec = new THREE.Vector3();
            var targetVec = new THREE.Vector3();
            var axis = new THREE.Vector3();
            var q = new THREE.Quaternion();
            var bones = this.mesh.skeleton.bones;
            var iks = this.mesh.geometry.iks;

            // for reference overhead reduction in loop
            var math = Math;
            for (var i = 0, il = iks.length; i < il; i++) {
                var ik = iks[i];
                var effector = bones[ik.effector];
                var target = bones[ik.target];
                var targetPos = target.getWorldPosition();
                var links = ik.links;
                var iteration = ik.iteration !== undefined? ik.iteration: 1;

                for (var j = 0; j < iteration; j++) {
                    for (var k = 0, kl = links.length; k < kl; k++) {
                        var link = bones[links[k].index];
                        var limitation = links[k].limitation;
                        var linkPos = link.getWorldPosition();
                        var invLinkQ = link.getWorldQuaternion().inverse();
                        var effectorPos = effector.getWorldPosition();

                        // work in link world
                        effectorVec.subVectors(effectorPos, linkPos);
                        effectorVec.applyQuaternion(invLinkQ);
                        effectorVec.normalize();

                        targetVec.subVectors(targetPos, linkPos);
                        targetVec.applyQuaternion(invLinkQ);
                        targetVec.normalize();

                        var angle = targetVec.dot(effectorVec);

                        // TODO: continue (or break) the loop for the performance
                        //       if no longer needs to rotate (angle > 1.0-1e-5 ?)
                        if (angle > 1.0) {
                            angle = 1.0;
                        } else if (angle < -1.0) {
                            angle = -1.0;
                        }
                        angle = math.acos(angle);

                        if (ik.minAngle !== undefined && angle < ik.minAngle) angle = ik.minAngle;
                        if (ik.maxAngle !== undefined && angle > ik.maxAngle) angle = ik.maxAngle;

                        axis.crossVectors(effectorVec, targetVec);
                        axis.normalize();

                        q.setFromAxisAngle(axis, angle);
                        link.quaternion.multiply(q);

                        // 制限付き修正合成回転（要再検討）
                        if (limitation !== undefined) {
                            var c = link.quaternion.w;
                            if (c > 1.0) c = 1.0;

                            var c2 = math.sqrt(1-c*c);
                            link.quaternion.set(
                                limitation.x * c2,
                                limitation.y * c2,
                                limitation.z * c2,
                                c );
                        }
                        link.updateMatrixWorld(true);
                    }
                }
            }
        },
    })
})();

