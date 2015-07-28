(function() {
    tm.asset = tm.asset || {};

    tm.define("tm.asset.VMD", {
        superClass: "tm.event.EventDispatcher",

        init: function(path) {
            this.superInit();

            this.vmd = null;
            this.path = path;
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
                that.loadFromData(data);
            };
            req.send(null);
        },

        //データからロード
        loadFromData: function(data) {
            this.dv = tm.DataViewEx(data);
            this.offset = 0;
            this.vmd = this._parse(data);
            this.flare("load");
        },

        _parse: function(data) {
            var dv = this.dv;
            var vmd = {};
            vmd.metadata = {};
            vmd.metadata.format = 'vmd';
            var metadata = vmd.metadata;

            // Header
            metadata.magic = dv.getChars(30);
            if (metadata.magic !== 'Vocaloid Motion Data 0002') {
                console.warn("{0}はVMDじゃないよ".format(this.path));
                vmd.result = "This File is not VMD.";
                vmd.error = true;
            }
            metadata.name = dv.getSjisStrings(20);

            // Motion
            metadata.motionCount = dv.getUint32();
            vmd.motions = [];
            for (var i = 0; i < metadata.motionCount; i++) {
                var m = {};
                m.boneName = dv.getSjisStrings(15);
                m.frameNum = dv.getUint32();
                m.position = [dv.getFloat32(), dv.getFloat32(), dv.getFloat32()];
                m.rotation = [dv.getFloat32(), dv.getFloat32(), dv.getFloat32(), dv.getFloat32()];
                m.interpolation = [];
                for ( var j = 0; j < 64; j++ ) {
                    m.interpolation.push(dv.getUint8());
                }
                vmd.motions.push(m);
            }

            // Morphing
            metadata.morphCount = dv.getUint32();
            vmd.morphs = [];
            for (var i = 0; i < metadata.morphCount; i++) {
                var m = {};
                m.morphName = dv.getSjisStrings(15);
                m.frameNum = dv.getUint32();
                m.weight = dv.getFloat32();
                vmd.morphs.push(m);
            }
            return vmd;
        }
    });

    //ローダーに拡張子登録
    tm.asset.Loader.register("vmd", function(path) {
        return tm.asset.VMD(path);
    });

})();

