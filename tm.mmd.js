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

                that.ikSolver = new tm.hybrid.mmd.CCDIKSolver(mesh);
                that.flare("load");
            }, onProgress, onError);
        }
    });

    //ローダーに拡張子登録
    tm.asset.Loader.register("mmd", function(path) {
        return tm.asset.MMD(path);
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
        var mesh = loader.createMesh(pmd.pmd, vmd.vmd, pmd.texturePath, onProgress, onError);
        mesh.position.y = -10;

        var hybridMesh = tm.hybrid.MMDMesh(mesh);

        hybridMesh._animation = new THREE.Animation(mesh, mesh.geometry.animation);
        hybridMesh._animation.play();

        hybridMesh._morphAnimation = new THREE.MorphAnimation2(mesh, mesh.geometry.morphAnimation);
        hybridMesh._morphAnimation.play();

        hybridMesh._ikSolver = new tm.hybrid.mmd.CCDIKSolver(mesh);
        hybridMesh.on('enterframe', function(e) {
            this._ikSolver.update();
        }.bind(hybridMesh));

        return hybridMesh;
    }

    //CCD法によるIK解決
    tm.define("tm.hybrid.mmd.CCDIKSolver", {
        init: function(mesh) {
            this.mesh = mesh;
        },
        update: function() {
            var effectorVec = new THREE.Vector3();
            var targetVec = new THREE.Vector3();
            var axis = new THREE.Vector3();
            var q = new THREE.Quaternion();
            var bones = this.mesh.skeleton.bones;
            var iks = this.mesh.geometry.iks;

            // for reference overhead reduction in loop
            var math = Math;
            for (var i = 0, il = iks.length; i < il; i++) {
                var ik = iks[i];
                var effector = bones[ik.effector];
                var target = bones[ik.target];
                var targetPos = target.getWorldPosition();
                var links = ik.links;
                var iteration = ik.iteration !== undefined? ik.iteration: 1;

                for (var j = 0; j < iteration; j++) {
                    for (var k = 0, kl = links.length; k < kl; k++) {
                        var link = bones[links[k].index];
                        var limitation = links[k].limitation;
                        var linkPos = link.getWorldPosition();
                        var invLinkQ = link.getWorldQuaternion().inverse();
                        var effectorPos = effector.getWorldPosition();

                        // work in link world
                        effectorVec.subVectors(effectorPos, linkPos);
                        effectorVec.applyQuaternion(invLinkQ);
                        effectorVec.normalize();

                        targetVec.subVectors(targetPos, linkPos);
                        targetVec.applyQuaternion(invLinkQ);
                        targetVec.normalize();

                        var angle = targetVec.dot(effectorVec);

                        // TODO: continue (or break) the loop for the performance
                        //       if no longer needs to rotate (angle > 1.0-1e-5 ?)
                        if (angle > 1.0) {
                            angle = 1.0;
                        } else if (angle < -1.0) {
                            angle = -1.0;
                        }
                        angle = math.acos(angle);

                        if (ik.minAngle !== undefined && angle < ik.minAngle) angle = ik.minAngle;
                        if (ik.maxAngle !== undefined && angle > ik.maxAngle) angle = ik.maxAngle;

                        axis.crossVectors(effectorVec, targetVec);
                        axis.normalize();

                        q.setFromAxisAngle(axis, angle);
                        link.quaternion.multiply(q);

                        // 制限付き修正合成回転（要再検討）
                        if (limitation !== undefined) {
                            var c = link.quaternion.w;
                            if (c > 1.0) c = 1.0;

                            var c2 = math.sqrt(1-c*c);
                            link.quaternion.set(
                                limitation.x * c2,
                                limitation.y * c2,
                                limitation.z * c2,
                                c );

                        }
                        link.updateMatrixWorld(true);
                    }
                }
            }
        },
    })
})();

