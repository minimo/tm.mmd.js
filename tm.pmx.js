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
            var pmx = {};
            pmx.metadata = {};
            pmx.metadata.format = 'pmx';
            var metadata = pmd.metadata;

            // Header
            metadata.magic = dv.getChars(3);
            if (metadata.magic !== 'Pmx') {
                console.warn("{0}はPMDじゃないよ".format(this.path));
                pmx.result = "This File is not PMX.";
                pmx.error = true;
                return pmd;
            }

            metadata.version = dv.getFloat32();
            metadata.modelName = dv.getSjisStrings(20);
            metadata.comment = dv.getSjisStrings(256);

            return pmx;
        },
    });

    //ローダーに拡張子登録
    tm.asset.Loader.register("pmx", function(path) {
        return tm.asset.PMX(path);
    });
})();
