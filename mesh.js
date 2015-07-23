/*
 * mesh.js
 */

(function() {
    // var tm = require("../../../libs/tmlib");
    // var THREE = require("../../../libs/three");
    // require("./delegateutil");
    // require("./threeelement");

    tm.define("tm.hybrid.Mesh", {
        superClass: "tm.hybrid.ThreeElement",

        init: function(mesh) {
            if (typeof(mesh) === "string") {
                var asset = tm.asset.Manager.get(mesh);
                if (asset) {
                    if (asset instanceof tm.asset.ThreeJSON) {
                        this.superInit(asset.mesh.clone());
                    } else if (asset instanceof tm.asset.MQO) {
                        this.superInit(asset.model.meshes[0]);
                        for (var i = 1; i < asset.model.meshes.length; i++) {
                            tm.hybrid.Mesh(asset.model.meshes[i]).addChildTo(this);
                        }
                    } else if (asset instanceof tm.asset.PMD) {
                        var loader = new THREE.MMDLoader();
                        var mesh = loader.createMesh(asset.data, undefined, asset.pmd.texturePath, function(){}, function(){});
                        this.superInit(mesh);
                    } else if (asset instanceof tm.asset.MMD) {
                        this.superInit(asset.mesh);
                        this._animation = asset.animation;
                        this._morphAnimation = asset.morphAnimation;
                        this._ikSolver = asset.ikSolver;
                        var that = this;
                        this.on('enterframe', function(e) {
                            that._ikSolver.update();
                        });
                    }
                } else {
                    console.error("アセット'{0}'がないよ".format(mesh));
                }
            } else if (mesh instanceof THREE.Mesh) {
                this.superInit(mesh);
            } else if (mesh instanceof THREE.Geometry) {
                if (arguments.length >= 2) {
                    this.superInit(new THREE.Mesh(mesh, arguments[1]));
                } else {
                    this.superInit(new THREE.Mesh(mesh));
                }
            } else {
                this.superInit(new THREE.Mesh());
            }
        },

        playAnimation: function(startTime, weight) {
            if (this._animation && this._morphAnimation) {
                this._animation.play(startTime, weight);
                this._morphAnimation.play(startTime);
            }
        },

        stopAnimation: function() {
            if (this._animation && this._morphAnimation) {
                this._animation.stop();
                this._morphAnimation.stop();
            }
        },
    });

    var delegater = tm.hybrid.DelegateUtil(tm.hybrid.Mesh);

    delegater.property("geometry");
    delegater.property("material");

    delegater.method("getMorphTargetIndexByName", true);
    delegater.method("updateMorphTargets", true);

})();
