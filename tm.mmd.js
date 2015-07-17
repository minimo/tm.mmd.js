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

            var onProgress = function(xhr) {
            };
            var onError = function(xhr) {
            };

            var that = this;
            var loader = new THREE.MMDLoader();
            loader.load( modelPath, motionPath, function (object) {
                var mesh = that.mesh = object;
                mesh.position.y = -10;

                var animation = new THREE.Animation(mesh, mesh.geometry.animation);
                animation.play();

                var morphAnimation = new THREE.MorphAnimation2(mesh, mesh.geometry.morphAnimation);
                morphAnimation.play();

                mesh.ikSolver = new THREE.CCDIKSolver(mesh);
                that.flare("load");
            }, onProgress, onError);
            
        }
    });

    //ローダーに拡張子登録
    tm.asset.Loader.register("mmd", function(path) {
        return tm.asset.MMD(path);
    });
})();

