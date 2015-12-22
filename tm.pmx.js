/*
 * pmx.js
 */

(function() {
    tm.asset = tm.asset || {};

    tm.define("tm.asset.PMX", {
        superClass: "tm.event.EventDispatcher",

        init: function(path) {
            this.superInit();
            this.pmx = null;
            this.path = path;
            this.texturePath = null;
            this.loadFromURL(path);
        },

        // URLからロード
        loadFromURL: function(path) {
            var that = this;
            var req = new XMLHttpRequest();
            req.open("GET", path, true);
            req.responseType = "arraybuffer";
            req.onload = function() {
                var data = req.response;
                that.loadFromData(data, path);
            };
            req.send(null);
        },

        //データからロード
        loadFromData: function(data, path) {
            this.pmx = PMXParser(data, path);
            this.flare("load");
        },
    });

    PMXParser = function(data, path) {
        var dv = tm.DataViewEx(data);
        var pmx = {};
        pmx.metadata = {};
        pmx.metadata.format = 'pmx';
        var metadata = pmx.metadata;

        //テクスチャパス
        path = path || "";
        var url = path.split("/");
        pmx.texturePath = "";
        for (var i = 0, len = url.length; i < len-1; i++) {
            pmx.texturePath += url[i]+"/";
        }

        // Header
        metadata.magic = dv.getChars(4);
        if (metadata.magic !== 'PMX ') {
            console.warn("{0}はPMXじゃないよ".format(this.path));
            pmx.result = "This File is not PMX.";
            pmx.error = true;
            return pmx;
        }

        metadata.version = dv.getFloat32();
        metadata.settingSize = dv.getUint8();
        metadata.encode = dv.getUint8();
        metadata.appendUV = dv.getUint8();
        metadata.vertexIndexSize = dv.getUint8();
        metadata.boneIndexSize = dv.getUint8();
        metadata.morphIndexSize = dv.getUint8();
        metadata.rigidIndexSize = dv.getUint8();

        var len = dv.getUint32();
        metadata.modelName = dv.getSjisStrings(len);
        var len = dv.getUint32();
        metadata.modelNameEn = dv.getSjisStrings(len);
        var len = dv.getUint32();
        metadata.comment = dv.getSjisStrings(len);
        var len = dv.getUint32();
        metadata.commentEn = dv.getSjisStrings(len);

        var readBoneIndex = function() {
            var len = dv.getUint32();
            var bones = [];
            for (var i = 0; i < len; i++) {
                
            }
            return bones;
        }

        // Vertices
        metadata.vertexCount = dv.getUint32();
        pmx.vertices = [];
        for (var i = 0; i < metadata.vertexCount; i++) {
            var v = {}
            v.position = [dv.getFloat32(), dv.getFloat32(), dv.getFloat32()];
            v.normal = [dv.getFloat32(), dv.getFloat32(), dv.getFloat32()];
            v.uv = [dv.getFloat32(), dv.getFloat32()];
            v.appendUV = [];
            for (var j = 0; j < metadata.appendUV*4; j++) {
                v.appendUV.push(dv.getFloat32());
            }

            //スキンのデフォーム形式によって分岐
            var w = 0.0;
            v.skinDeformType = getInt8();
            switch (v.skinDeformType) {
                // BDEF1
                case 0:
                    this.bones = [dv.getUint32()];
                    this.weights = [1.0];
                    break;
                // BDEF2
                case 1:
                    this.bones = [dv.getUint32(), dv.getUint32()];
                    w = dv.gerFloat32();
                    this.weights = [w, 1.0-w];
                    break;
                // BDEF4
                case 2:
                    this.bones = [dv.getUint32(), dv.getUint32(), dv.getUint32(), dv.getUint32()];
                    this.weights = [dv.gerFloat32(), dv.gerFloat32(), dv.gerFloat32(), dv.gerFloat32()];
                    break;
                case 3: // SDEF
                    this.bones = [dv.getUint32(), dv.getUint32()];
                    w = dv.getFloat32();
                    this.weights = [w, 1.0-w];
                    this.sdefC  = [dv.getFloat32(), dv.getFloat32(), dv.getFloat32()];
                    this.sdefR0 = [dv.getFloat32(), dv.getFloat32(), dv.getFloat32()];
                    this.sdefR1 = [dv.getFloat32(), dv.getFloat32(), dv.getFloat32()];
                    break;
            }
            v.edgeScale = dv.getFloat32();
            pmx.vertices.push(v);
        }

        // Faces
        metadata.faceCount = dv.getUint32()/3;
        pmx.faces = [];
        for (var i = 0; i < metadata.faceCount; i++) {
            var f = {};
            f.indices = [dv.getUint16(), dv.getUint16(), dv.getUint16()];
            pmx.faces.push(f);
        }

        // Texture
        metadata.textureCount = dv.getUint32();
        pmx.texturePath = [];
        for (var i = 0; i < metadata.faceCount; i++) {
            var len = dv.getUint32();
            pmx.texturePath.push(dv.getSjisStrings(len));
        }

        // Materials
        metadata.materialCount = dv.getUint32();
        pmx.materials = [];
        for (var i = 0; i < metadata.materialCount; i++) {
            var m = {};
            var len = dv.getUint32();
            m.materialName = dv.getSjisStrings(len);
            var len = dv.getUint32();
            m.materialNameEn = dv.getSjisStrings(len);

            m.diffuse = [dv.getFloat32(), dv.getFloat32(), dv.getFloat32(), dv.getFloat32()];
            m.specular = [dv.getFloat32(), dv.getFloat32(), dv.getFloat32()];
            m.power = dv.getFloat32();
            m.ambient = [dv.getFloat32(), dv.getFloat32(), dv.getFloat32()];

            m.renderFlag = dv.getUint8();

            m.edge = [dv.getFloat32(), dv.getFloat32(), dv.getFloat32()];
            m.edgeSize = dv.getFloat32();

            m.toonIndex = dv.getUint8();
            m.edgeFlag = dv.getUint8();
            m.faceCount = dv.getUint32()/3;
            m.fileName = dv.getChars(20);
            pmx.materials.push(m);
        }

        // Bones
        metadata.boneCount = dv.getUint16();
        pmx.bones = [];
        for (var i = 0; i < metadata.boneCount; i++) {
            var b = {};
            b.name = dv.getSjisStrings(20);
            b.parentIndex = dv.getUint16();
            b.tailIndex = dv.getUint16();
            b.type = dv.getUint8();
            b.ikIndex = dv.getUint16();
            b.position = [dv.getFloat32(), dv.getFloat32(), dv.getFloat32()];
            pmx.bones.push(b);
        }

        // IK
        metadata.ikCount = dv.getUint16();
        pmx.iks = [];
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
            pmx.iks.push(ik);
        }

        // Morphing
        metadata.morphCount = dv.getUint16();
        pmx.morphs = [];
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
            pmx.morphs.push(m);
        }
        return pmx;
    }

    //ローダーに拡張子登録
    tm.asset.Loader.register("pmx", function(path) {
        return tm.asset.PMX(path);
    });
})();
