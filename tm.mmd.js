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

                that.ikSolver = new THREE.CCDIKSolver(mesh);
                that.flare("load");
            }, onProgress, onError);
        }
    });

    tm.define("tm.asset.PMD", {
        superClass: "tm.event.EventDispatcher",

        init: function(path) {
            this.data = null;
            this.texturePath = null;
            this.superInit();
            this.load(path);
        },

        load: function(path) {
            var onProgress = function(xhr) {};
            var onError = function(xhr) {};

            var that = this;
            var loader = new THREE.MMDLoader();
        	this.texturePath = loader.extractUrlBase(path);
            loader.loadFileAsBuffer(path, function(buffer) {
                that.data = loader.parsePmd(buffer);
                that.flare("load");
            }, onProgress, onError);
        }
    });

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
    tm.asset.Loader.register("mmd", function(path) {
        return tm.asset.MMD(path);
    });
    tm.asset.Loader.register("pmd", function(path) {
        return tm.asset.PMD(path);
    });
    tm.asset.Loader.register("vmd", function(path) {
        return tm.asset.VMD(path);
    });

    tm.hybrid.createMeshFromMMD = function(pmdName, vmdName) {
        var pmd = tm.asset.Manager.get(pmdName);
        if (!pmd) {
            console.error("アセット'{0}'がないよ".format(pmdName));
            return null;
        }
        if (!(pmd instanceof tm.asset.PMD)) {
            console.error("アセット'{0}'はPMDじゃないよ".format(pmdName));
            return null;
        }

        var vmd = tm.asset.Manager.get(vmdName);
        if (!vmd) {
            console.error("アセット'{0}'がないよ".format(vmdName));
            return null;
        }
        if (!(vmd instanceof tm.asset.VMD)) {
            console.error("アセット'{0}'はVMDじゃないよ".format(vmdName));
            return null;
        }

        var onProgress = function(xhr) {};
        var onError = function(xhr) {};

        var loader = new THREE.MMDLoader();
        var mesh = loader.createMesh(pmd.data, vmd.data, pmd.texturePath, onProgress, onError);
        mesh.position.y = -10;

        var hybridMesh = tm.hybrid.Mesh(mesh);

        hybridMesh._animation = new THREE.Animation(mesh, mesh.geometry.animation);
        hybridMesh._animation.play();

        hybridMesh._morphAnimation = new THREE.MorphAnimation2(mesh, mesh.geometry.morphAnimation);
        hybridMesh._morphAnimation.play();

        hybridMesh._ikSolver = new THREE.CCDIKSolver(mesh);
        hybridMesh.on('enterframe', function(e) {
            this._ikSolver.update();
        }.bind(hybridMesh));

        return hybridMesh;
    }
})();

