(function() {
    tm.asset = tm.asset || {};

    tm.define("tm.asset.PMD", {
        superClass: "tm.event.EventDispatcher",

        init: function(path) {
            this.data = null;
            this.texturePath = null;
            this.superInit();
            this.load(path);
        },

        load: function(path) {
        },

        _parse: function() {
        },
    });

    //ローダーに拡張子登録
    tm.asset.Loader.register("pmd", function(path) {
        return tm.asset.PMD(path);
    });
})();

