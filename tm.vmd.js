(function() {
    tm.asset = tm.asset || {};

    tm.define("tm.asset.VMD", {
        superClass: "tm.event.EventDispatcher",

        init: function(path) {
            this.data = null;
            this.superInit();
            this.load(path);
        },

        load: function(path) {
            var onProgress = function(xhr) {};
            var onError = function(xhr) {};

            var that = this;
            var loader = new THREE.MMDLoader();
            loader.loadFileAsBuffer(path, function(buffer) {
                that.data = loader.parseVmd(buffer);
                that.flare("load");
            }, onProgress, onError);
        }
    });

    //ローダーに拡張子登録
    tm.asset.Loader.register("vmd", function(path) {
        return tm.asset.VMD(path);
    });

})();

