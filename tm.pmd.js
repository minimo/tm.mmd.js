/*
 * pmd.js
 */

(function() {
    tm.asset = tm.asset || {};

    tm.define("tm.asset.PMD", {
        superClass: "tm.event.EventDispatcher",

        init: function(path) {
            this.superInit();
            this.pmd = null;
            this.path = path;
            this.texturePath = null;
            this.loadFromURL(path);
        },

        // URLからロード
        loadFromURL: function(path) {
            var url = path.split("/");
            this.texturePath = "";
            for (var i = 0, len = url.length; i < len-1; i++) {
                this.texturePath += url[i]+"/";
            }

            var that = this;
            var req = new XMLHttpRequest();
            req.open("GET", path, true);
            req.responseType = "arraybuffer";
            req.onload = function() {
                var data = req.response;
                that.loadFromData(data);
            };
            req.send(null);
        },

        //データからロード
        loadFromData: function(data) {
            this.dv = tm.DataViewEx(data);
            this.offset = 0;
            this.pmd = this._parse(data);
            this.flare("load");
        },

        _parse: function(data) {
            var dv = this.dv;
            var pmd = {};
            pmd.metadata = {};
            pmd.metadata.format = 'pmd';
            var metadata = pmd.metadata;

            // Header
            metadata.magic = dv.getChars(3);
            if (metadata.magic !== 'Pmd') {
                console.warn("{0}はPMDじゃないよ".format(this.path));
                pmd.result = "This File is not PMD.";
                pmd.error = true;
                return pmd;
            }

            metadata.version = dv.getFloat32();
            metadata.modelName = dv.getSjisStrings(20);
            metadata.comment = dv.getSjisStrings(256);

            // Vertices
            metadata.vertexCount = dv.getUint32();
            pmd.vertices = [];
            for (var i = 0; i < metadata.vertexCount; i++) {
                var v = {}
                v.position = [dv.getFloat32(), dv.getFloat32(), dv.getFloat32()];
                v.normal = [dv.getFloat32(), dv.getFloat32(), dv.getFloat32()];
                v.uv = [dv.getFloat32(), dv.getFloat32()];
                v.skinIndices = [dv.getUint16(), dv.getUint16()];
                v.skinWeight = dv.getUint8();
                v.edgeFlag = dv.getUint8();
                pmd.vertices.push(v);
            }

            // Faces
            metadata.faceCount = dv.getUint32()/3;
            pmd.faces = [];
            for (var i = 0; i < metadata.faceCount; i++) {
                var f = {};
                f.indices = [dv.getUint16(), dv.getUint16(), dv.getUint16()];
                pmd.faces.push(f);
            }

            // Materials
            metadata.materialCount = dv.getUint32();
            pmd.materials = [];
            for (var i = 0; i < metadata.materialCount; i++) {
                var m = {};
                m.diffuse = [dv.getFloat32(), dv.getFloat32(), dv.getFloat32(), dv.getFloat32()];
                m.shiness = dv.getFloat32();
                m.specular = [dv.getFloat32(), dv.getFloat32(), dv.getFloat32()];
                m.emissive = [dv.getFloat32(), dv.getFloat32(), dv.getFloat32()];
                m.toonIndex = dv.getUint8();
                m.edgeFlag = dv.getUint8();
                m.faceCount = dv.getUint32()/3;
                m.fileName = dv.getChars(20);
                pmd.materials.push(m);
            }

            // Bones
            metadata.boneCount = dv.getUint16();
            pmd.bones = [];
            for (var i = 0; i < metadata.boneCount; i++) {
                var b = {};
                b.name = dv.getSjisStrings(20);
                b.parentIndex = dv.getUint16();
                b.tailIndex = dv.getUint16();
                b.type = dv.getUint8();
                b.ikIndex = dv.getUint16();
                b.position = [dv.getFloat32(), dv.getFloat32(), dv.getFloat32()];
                pmd.bones.push(b);
            }

            // IK
            metadata.ikCount = dv.getUint16();
            pmd.iks = [];
            for (var i = 0; i < metadata.ikCount; i++) {
                var ik = {};
                ik.target = dv.getUint16();
                ik.effector = dv.getUint16();
                ik.linkCount = dv.getUint8();
                ik.iteration = dv.getUint16();
                ik.maxAngle = dv.getFloat32();
                ik.links = [];
                for (var j = 0; j < ik.linkCount; j++) {
                    ik.links.push(dv.getUint16());
                }
                pmd.iks.push(ik);
            }

            // Morphing
            metadata.morphCount = dv.getUint16();
            pmd.morphs = [];
            for (var i = 0; i < metadata.morphCount; i++) {
                var m = {};
                m.name = dv.getSjisStrings(20);
                m.vertexCount = dv.getUint32();
                m.type = dv.getUint8();
                m.vertices = [];
                for (var j = 0; j < m.vertexCount; j++) {
                    var mv = {};
                    mv.index = dv.getUint32();
                    mv.position = [dv.getFloat32(), dv.getFloat32(), dv.getFloat32()];
                    m.vertices.push(mv) ;
                }
                pmd.morphs.push(m);
            }
            return pmd;
        },
    });

    //ローダーに拡張子登録
    tm.asset.Loader.register("pmd", function(path) {
        return tm.asset.PMD(path);
    });

    tm.define("tm.DataViewEx", {
        init: function(buffer) {
            // Check Little Endian
            this.littleEndian = ((new Uint8Array((new Uint16Array([0x00ff])).buffer))[0])? true: false;
            this.dv = new DataView(buffer);
            this.offset = 0;
        },
        getInt8: function() {
            var value = this.dv.getInt8(this.offset);
            this.offset += 1;
            return value;
        },
        getUint8: function() {
            var value = this.dv.getUint8(this.offset);
            this.offset += 1;
            return value;
        },
        getInt16: function() {
            var value = this.dv.getInt16(this.offset, this.littleEndian);
            this.offset += 2;
            return value;
        },
        getUint16: function() {
            var value = this.dv.getUint16(this.offset, this.littleEndian);
            this.offset += 2;
            return value;
        },
        getInt32: function() {
            var value = this.dv.getInt32(this.offset, this.littleEndian);
            this.offset += 4;
            return value;
        },
        getUint32: function() {
            var value = this.dv.getUint32(this.offset, this.littleEndian);
            this.offset += 4;
            return value;
        },
        getFloat32: function() {
            var value = this.dv.getFloat32(this.offset, this.littleEndian);
            this.offset += 4;
            return value;
        },
        getFloat64: function() {
            var value = this.dv.getFloat64(this.offset, this.littleEndian);
            this.offset += 8;
            return value;
        },
        getChars: function(size) {
            var str = '';
            while (size > 0) {
                var value = this.getUint8();
                size--;
                if(value === 0) break;
                str += String.fromCharCode(value);
            }
            while (size>0) {
                this.getUint8();
                size--;
            }
            return str;
        },

        // using temporal workaround because Shift_JIS binary -> utf conversion isn't so easy.
        // Shift_JIS binary will be converted to hex strings with prefix '0x' on each byte.
        // for example Shift_JIS 'あいうえお' will be '0x82x0xa00x820xa20x800xa40x820xa60x820xa8'.
        // functions which handle Shift_JIS data (ex: bone name check) need to know this trick.
        // TODO: Shift_JIS support (by using http://imaya.blog.jp/archives/6368510.html)
        getSjisStrings: function(size) {
            var str = '';
            while (size>0) {
                var value = this.getUint8();
                size--;
                if (value === 0) break;
                str += '0x' + ('0' + value.toString(16)).substr(-2);
            }
            while (size>0) {
                this.getUint8();
                size--;
            }
            return str;
        }
    });
})();
