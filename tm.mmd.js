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

                that.animation = new THREE.Animation(mesh, mesh.geometry.animation);
                that.animation.play();

                that.morphAnimation = new THREE.MorphAnimation2(mesh, mesh.geometry.morphAnimation);
                that.morphAnimation.play();

                mesh.ikSolver = new THREE.CCDIKSolver(mesh);
                that.flare("load");
            }, onProgress, onError);
        }
    });

    tm.define("tm.asset.PMD", {
        superClass: "tm.event.EventDispatcher",

        init: function(path) {
            this.mesh = null;
            this.superInit();
            this.load(path);
        },

        load: function(path) {
            var onProgress = function(xhr) {
            };
            var onError = function(xhr) {
            };

            var that = this;
            var loader = new THREE.MMDLoader();
            loader.load(path, undefined, function (object) {
                var mesh = that.mesh = object;
                mesh.position.y = -10;
                that.flare("load");
            }, onProgress, onError);
        }
    });

    tm.define("tm.asset.VMD", {
        superClass: "tm.event.EventDispatcher",

        init: function(path) {
            this.superInit();
            this.load(path);
        },

        load: function(path) {
            var onProgress = function(xhr) {
            };
            var onError = function(xhr) {
            };

            var that = this;
            var loader = new THREE.MMDLoader();
            loader.loadVmdFile(
        }
    });

    //ローダーに拡張子登録
    tm.asset.Loader.register("mmd", function(path) {
        return tm.asset.MMD(path);
    });
    tm.asset.Loader.register("pmd", function(path) {
        return tm.asset.PMD(path);
    });
    tm.asset.Loader.register("vmd", function(path) {
        return tm.asset.VMD(path);
    });
})();

