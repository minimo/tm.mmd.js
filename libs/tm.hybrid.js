/*
The MIT License (MIT)

Copyright (c) 2015 daishi_hmr

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/
/*
 * delegateuril.js
 */

(function() {
    // var tm = require("../../../libs/tmlib");

    tm.define("tm.hybrid.DelegateUtil", {
        init: function(type) {
            this.type = type;
        },
        property: function(name, threeProperty) {
            if (threeProperty) {
                this.type.prototype.accessor(name, {
                    get: function() {
                        return this.threeObject[threeProperty][name];
                    },
                    set: function(v) {
                        this.threeObject[threeProperty][name] = v;
                    }
                });
            } else {
                this.type.prototype.accessor(name, {
                    get: function() {
                        return this.threeObject[name];
                    },
                    set: function(v) {
                        this.threeObject[name] = v;
                    }
                });
            }

            this.type.defineInstanceMethod(createSetterName(name), function(v) {
                this[name] = v;
                return this;
            });
        },
        method: function(name, returnThis, threeProperty) {
            if (threeProperty) {
                this.type.defineInstanceMethod(name, function() {
                    var r = this.threeObject[threeProperty][name].apply(this.threeObject[threeProperty], arguments);
                    if (returnThis) {
                        return this;
                    } else {
                        return r;
                    }
                });
            } else {
                this.type.defineInstanceMethod(name, function() {
                    var r = this.threeObject[name].apply(this.threeObject, arguments);
                    if (returnThis) {
                        return this;
                    } else {
                        return r;
                    }
                });
            }
        },
    });

    function createSetterName(propertyName) {
        return "set" + propertyName[0].toUpperCase() + propertyName.substring(1);
    }
})();

/*
 * threeelement.js
 */

(function() {
    // var tm = require("../../../libs/tmlib");
    // var THREE = require("../../../libs/three");
    // require("./delegateutil");

    tm.define("tm.hybrid.ThreeElement", {
        superClass: "tm.app.Element",

        init: function(threeObject) {
            this.superInit();

            /** @type {THREE.Object3D} */
            this.threeObject = threeObject || new THREE.Object3D();
        },

        /** @override */
        addChild: function(child) {
            if (child.parent) child.remove();
            child.parent = this;
            this.children.push(child);

            if (child instanceof tm.hybrid.ThreeElement) {
                this.threeObject.add(child.threeObject);
            }

            var e = tm.event.Event("added");
            child.dispatchEvent(e);

            return child;
        },

        /** @override */
        removeChild: function(child) {
            var index = this.children.indexOf(child);
            if (index != -1) {
                this.children.splice(index, 1);

                if (child instanceof tm.hybrid.ThreeElement) {
                    this.threeObject.remove(child.threeObject);
                }

                var e = tm.event.Event("removed");
                child.dispatchEvent(e);
            }
        },

        setPosition: function(x, y, z) {
            this.x = x;
            this.y = y;
            this.z = z;
            return this;
        },

        setRotation: function(x, y, z) {
            this.rotationX = x;
            this.rotationY = y;
            this.rotationZ = z;
            return this;
        },
        setRotationX: function(x) {
            this.rotationX = x;
            return this;
        },
        setRotationY: function(y) {
            this.rotationY = y;
            return this;
        },
        setRotationZ: function(z) {
            this.rotationZ = z;
            return this;
        },

        rotatePitch: function(degree) {
            var q = tempQuat.setFromAxisAngle(V3_RIGHT, degree * Math.DEG_TO_RAD);
            this.quaternion.multiply(q);
        },
        rotateYaw: function(degree) {
            var q = tempQuat.setFromAxisAngle(V3_UP, degree * Math.DEG_TO_RAD);
            this.quaternion.multiply(q);
        },
        rotateRoll: function(degree) {
            var q = tempQuat.setFromAxisAngle(V3_FORWARD, degree * Math.DEG_TO_RAD);
            this.quaternion.multiply(q);
        },

        setScale: function(x, y, z) {
            if (arguments.length === 1) {
                y = x;
                z = x;
            }
            this.scaleX = x;
            this.scaleY = y;
            this.scaleZ = z;
            return this;
        },

        show: function() {
            this.visible = true;
            return this;
        },
        hide: function() {
            this.visible = false;
            return this;
        },
    });

    var V3_RIGHT = new THREE.Vector3(1, 0, 0);
    var V3_UP = new THREE.Vector3(0, 1, 0);
    var V3_FORWARD = new THREE.Vector3(0, 0, 1);
    var tempQuat = new THREE.Quaternion();

    var delegater = tm.hybrid.DelegateUtil(tm.hybrid.ThreeElement);

    delegater.property("id");
    delegater.property("uuid");
    delegater.property("name");

    tm.hybrid.ThreeElement.prototype.accessor("position", {
        get: function() {
            return this.threeObject.position;
        },
        set: function(v) {
            this.threeObject.position = v;
        }
    });
    delegater.property("x", "position");
    delegater.property("y", "position");
    delegater.property("z", "position");

    tm.hybrid.ThreeElement.prototype.accessor("scale", {
        get: function() {
            return this.threeObject.scale;
        },
        set: function(v) {
            this.threeObject.scale = v;
        }
    });
    tm.hybrid.ThreeElement.prototype.accessor("scaleX", {
        get: function() {
            return this.threeObject.scale.x;
        },
        set: function(v) {
            this.threeObject.scale.x = v;
        }
    });
    tm.hybrid.ThreeElement.prototype.accessor("scaleY", {
        get: function() {
            return this.threeObject.scale.y;
        },
        set: function(v) {
            this.threeObject.scale.y = v;
        }
    });
    tm.hybrid.ThreeElement.prototype.accessor("scaleZ", {
        get: function() {
            return this.threeObject.scale.z;
        },
        set: function(v) {
            this.threeObject.scale.z = v;
        }
    });
    delegater.property("eulerOrder");
    tm.hybrid.ThreeElement.prototype.accessor("rotation", {
        get: function() {
            return this.threeObject.rotation;
        },
        set: function(v) {
            this.threeObject.rotation = v;
        }
    });
    tm.hybrid.ThreeElement.prototype.accessor("rotationX", {
        get: function() {
            return this.threeObject.rotation.x * Math.RAD_TO_DEG;
        },
        set: function(v) {
            this.threeObject.rotation.x = v * Math.DEG_TO_RAD;
        }
    });
    tm.hybrid.ThreeElement.prototype.accessor("rotationY", {
        get: function() {
            return this.threeObject.rotation.y * Math.RAD_TO_DEG;
        },
        set: function(v) {
            this.threeObject.rotation.y = v * Math.DEG_TO_RAD;
        }
    });
    tm.hybrid.ThreeElement.prototype.accessor("rotationZ", {
        get: function() {
            return this.threeObject.rotation.z * Math.RAD_TO_DEG;
        },
        set: function(v) {
            this.threeObject.rotation.z = v * Math.DEG_TO_RAD;
        }
    });
    delegater.property("up");
    delegater.property("quaternion");
    delegater.property("visible");
    delegater.property("castShadow");
    delegater.property("receiveShadow");
    delegater.property("frustumCulled");
    delegater.property("matrixAutoUpdate");
    delegater.property("matrixWorldNeedsUpdate");
    delegater.property("rotationAutoUpdate");
    delegater.property("userData");
    delegater.property("matrixWorld");

    delegater.method("applyMatrix", true);
    delegater.method("translateX", true);
    delegater.method("translateY", true);
    delegater.method("translateZ", true);
    delegater.method("localToWorld");
    delegater.method("worldToLocal");
    delegater.method("lookAt", true);
    delegater.method("traverse", true);
    delegater.method("traverseVisible", true);
    delegater.method("traverseAncestors", true);
    delegater.method("updateMatrix", true);
    delegater.method("updateMatrixWorld", true);
    delegater.method("getObjectByName");
    delegater.method("rotateOnAxis", true);

    tm.hybrid.ThreeElement.prototype.localToGlobal = tm.hybrid.ThreeElement.prototype.localToWorld;
    tm.hybrid.ThreeElement.prototype.globalToLocal = tm.hybrid.ThreeElement.prototype.globalToLocal;

})();

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
                var threeJSON = tm.asset.Manager.get(mesh);
                if (threeJSON) {
                    this.superInit(threeJSON.mesh.clone());
                } else {
                    console.error("アセット'{0}'がないよ".format(mesh));
                }
            } else if (mesh instanceof THREE.Mesh) {
                this.superInit(mesh);
            } else if (mesh instanceof THREE.Geometry) {
                if (arguments.length >= 2) {
                    this.superInit(new THREE.Mesh(meth, arguments[1]));
                } else {
                    this.superInit(new THREE.Mesh(mesh));
                }
            } else {
                this.superInit(new THREE.Mesh());
            }
        },
    });

    var delegater = tm.hybrid.DelegateUtil(tm.hybrid.Mesh);

    delegater.property("geometry");
    delegater.property("material");

    delegater.method("getMorphTargetIndexByName", true);
    delegater.method("updateMorphTargets", true);

})();

/*
 * camera.js
 */

(function() {
    // var tm = require("../../../libs/tmlib");
    // var THREE = require("../../../libs/three");
    // require("./delegateutil");
    // require("./threeelement");

    tm.define("tm.hybrid.Camera", {
        superClass: "tm.hybrid.ThreeElement",

        init: function() {
            this.superInit(new THREE.PerspectiveCamera(45, 1, 1, 20000));
        },

        isInSight: function(obj) {
            tempVector.setFromMatrixPosition(obj.matrixWorld).project(this);
            return -1 <= tempVector.x && tempVector.x <= 1 && -1 <= tempVector.y && tempVector.y <= 1;
        },
    });

    var tempVector = new THREE.Vector3();

    var delegater = tm.hybrid.DelegateUtil(tm.hybrid.Camera);

    delegater.property("matrixWorldInverse");
    delegater.property("projectionMatrix");
    tm.hybrid.Camera.prototype.accessor("fov", {
        get: function() {
            return this.threeObject.fov;
        },
        set: function(v) {
            this.threeObject.fov = v;
            this.threeObject.updateProjectionMatrix();
        },
    });
    tm.hybrid.Camera.defineInstanceMethod("setFov", function(v) {
        this.fov = v;
        return this;
    });

    tm.hybrid.Camera.prototype.accessor("aspect", {
        get: function() {
            return this.threeObject.aspect;
        },
        set: function(v) {
            this.threeObject.aspect = v;
            this.threeObject.updateProjectionMatrix();
        },
    });
    tm.hybrid.Camera.defineInstanceMethod("setAspect", function(v) {
        this.aspect = v;
        return this;
    });

    tm.hybrid.Camera.prototype.accessor("near", {
        get: function() {
            return this.threeObject.near;
        },
        set: function(v) {
            this.threeObject.near = v;
            this.threeObject.updateProjectionMatrix();
        },
    });
    tm.hybrid.Camera.defineInstanceMethod("setNear", function(v) {
        this.near = v;
        return this;
    });

    tm.hybrid.Camera.prototype.accessor("far", {
        get: function() {
            return this.threeObject.far;
        },
        set: function(v) {
            this.threeObject.far = v;
            this.threeObject.updateProjectionMatrix();
        },
    });
    tm.hybrid.Camera.defineInstanceMethod("setFar", function(v) {
        this.far = v;
        return this;
    });

})();

/*
 * othrocamera.js
 */

(function() {
    // var tm = require("../../../libs/tmlib");
    // var THREE = require("../../../libs/three");
    // require("./threeelement");

    tm.define("tm.hybrid.OrthoCamera", {
        superClass: "tm.hybrid.ThreeElement",

        init: function() {
            this.superInit(new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 1, 10000));
        },
    });

    tm.hybrid.OrthoCamera.prototype.accessor("left", {
        get: function() {
            return this.threeObject.left;
        },
        set: function(v) {
            this.threeObject.left = v;
            this.threeObject.updateProjectionMatrix();
        },
    });
    tm.hybrid.OrthoCamera.prototype.accessor("right", {
        get: function() {
            return this.threeObject.right;
        },
        set: function(v) {
            this.threeObject.right = v;
            this.threeObject.updateProjectionMatrix();
        },
    });
    tm.hybrid.OrthoCamera.prototype.accessor("top", {
        get: function() {
            return this.threeObject.top;
        },
        set: function(v) {
            this.threeObject.top = v;
            this.threeObject.updateProjectionMatrix();
        },
    });
    tm.hybrid.OrthoCamera.prototype.accessor("bottom", {
        get: function() {
            return this.threeObject.bottom;
        },
        set: function(v) {
            this.threeObject.bottom = v;
            this.threeObject.updateProjectionMatrix();
        },
    });
    tm.hybrid.OrthoCamera.prototype.accessor("near", {
        get: function() {
            return this.threeObject.near;
        },
        set: function(v) {
            this.threeObject.near = v;
            this.threeObject.updateProjectionMatrix();
        },
    });
    tm.hybrid.OrthoCamera.prototype.accessor("far", {
        get: function() {
            return this.threeObject.far;
        },
        set: function(v) {
            this.threeObject.far = v;
            this.threeObject.updateProjectionMatrix();
        },
    });

})();

/*
 * shape.js
 */

(function() {
    // var tm = require("../../../libs/tmlib");
    // var THREE = require("../../../libs/three");
    // require("./mesh");

    tm.define("tm.hybrid.PlaneMesh", {
        superClass: "tm.hybrid.Mesh",

        init: function(geometryParam, materialParam) {
            geometryParam = {}.$extend(tm.hybrid.PlaneMesh.DEFAULT_GEOMETRY_PARAM, geometryParam);
            materialParam = {}.$extend(tm.hybrid.PlaneMesh.DEFAULT_MATERIAL_PARAM, materialParam);
            var geo = new THREE.PlaneGeometry(geometryParam.width, geometryParam.height, geometryParam.widthSegments, geometryParam.heightSegments);
            var mat = new THREE.MeshLambertMaterial(materialParam);
            this.superInit(new THREE.Mesh(geo, mat));
        },
    });
    tm.hybrid.PlaneMesh.DEFAULT_GEOMETRY_PARAM = {
        width: 1,
        height: 1,
        widthSegments: 1,
        heightSegments: 1,
    };
    tm.hybrid.PlaneMesh.DEFAULT_MATERIAL_PARAM = {
        color: 0xffffff,
    };

    tm.define("tm.hybrid.BoxMesh", {
        superClass: "tm.hybrid.Mesh",

        init: function(geometryParam, materialParam) {
            geometryParam = {}.$extend(tm.hybrid.BoxMesh.DEFAULT_GEOMETRY_PARAM, geometryParam);
            materialParam = {}.$extend(tm.hybrid.BoxMesh.DEFAULT_MATERIAL_PARAM, materialParam);
            var geo = new THREE.BoxGeometry(geometryParam.width, geometryParam.height, geometryParam.depth, geometryParam.widthSegments, geometryParam.heightSegments, geometryParam.depthSegments);
            var mat = new THREE.MeshLambertMaterial(materialParam);
            this.superInit(new THREE.Mesh(geo, mat));
        },
    });
    tm.hybrid.BoxMesh.DEFAULT_GEOMETRY_PARAM = {
        width: 1,
        height: 1,
        depth: 1,
        widthSegments: 1,
        heightSegments: 1,
        depthSegments: 1,
    };
    tm.hybrid.BoxMesh.DEFAULT_MATERIAL_PARAM = {
        color: 0xffffff,
    };

})();

/*
 * sprite.js
 */

(function() {
    // var tm = require("../../../libs/tmlib");
    // var THREE = require("../../../libs/three");
    // require("./threeelement");

    tm.define("tm.hybrid.Sprite", {
        superClass: "tm.hybrid.ThreeElement",

        init: function(image, xCellSize, yCellSize) {

            var imageName = null;
            var spriteMaterial = null;

            if (typeof(image) === "string") {
                imageName = image;
                spriteMaterial = tm.hybrid.Sprite.materialCache[image];
                if (!spriteMaterial) {
                    image = tm.asset.Manager.get(image);
                    if (!image) {
                        console.error("アセット{0}がないよ".format(image));
                    }
                }
            } else {
                if (!image.id) {
                    image.id = THREE.Math.generateUUID();
                }
                imageName = image.id;
            }

            if (!spriteMaterial) {
                var texture = new THREE.Texture(image.element);
                texture.needsUpdate = true;
                // texture.sourceAssetName = imageName;

                spriteMaterial = new THREE.SpriteMaterial({
                    map: texture,
                    color: 0xffffff,
                    fog: true,
                });

                tm.hybrid.Sprite.materialCache[imageName] = spriteMaterial;
            }

            xCellSize = xCellSize || 1;
            yCellSize = yCellSize || 1;

            this.superInit(new THREE.Sprite(spriteMaterial));
        },
    });

    tm.hybrid.Sprite.materialCache = {};

})();

/*
 * texture.js
 */

(function() {
    // var tm = require("../../../libs/tmlib");
    // var THREE = require("../../../libs/three");

    tm.hybrid = tm.hybrid || {};

    tm.hybrid.Texture = function(image, mapping) {
        if (typeof image === "string") {
            image = tm.asset.Manager.get(image).element;
        } else if (image instanceof tm.graphics.Canvas || image instanceof tm.asset.Texture) {
            image = image.element;
        }

        var texture = new THREE.Texture(image, mapping);
        texture.needsUpdate = true;
        return texture;
    };
})();

/*
 * scene.js
 */

(function() {
    // var tm = require("../../../libs/tmlib");
    // var THREE = require("../../../libs/three");
    // require("./threeelement");
    // require("./camera");
    // require("./ambientlight");
    // require("./directionallight");

    tm.define("tm.hybrid.Scene", {
        superClass: "tm.app.Scene",

        two: null,
        three: null,

        effectComposer: null,

        init: function() {
            this.superInit();
            this.two = this;
            this.three = tm.hybrid.Scene.Three();

            // TODO どう扱うか
            this.effectComposer = null;

            this.on("enter", function(e) {
                this.camera.aspect = e.app.width / e.app.height;
            });
        },

        render: function(renderer) {
            renderer.render(this.three.scene, this.three.camera.threeObject);
        },

        /** @override */
        addChild: function(child) {
            if (child instanceof tm.hybrid.ThreeElement) {
                this.three.addChild(child);
            } else {
                tm.app.Scene.prototype.addChild.call(this, child);
            }
        },

        /** @override */
        removeChild: function(child) {
            if (child instanceof tm.hybrid.ThreeElement) {
                this.three.removeChild(child);
            } else {
                tm.app.Scene.prototype.removeChild.call(this, child);
            }
        },
    });
    tm.hybrid.Scene.prototype.accessor("camera", {
        get: function() {
            return this.three.camera;
        },
        set: function(v) {
            this.three.camera = v;
        },
    });
    tm.hybrid.Scene.prototype.accessor("ambientLight", {
        get: function() {
            return this.three.ambientLight;
        },
        set: function(v) {
            this.three.ambientLight = v;
        },
    });
    tm.hybrid.Scene.prototype.accessor("directionalLight", {
        get: function() {
            return this.three.directionalLight;
        },
        set: function(v) {
            this.three.directionalLight = v;
        },
    });

    tm.hybrid.Scene.prototype.accessor("fog", {
        get: function() {
            return this.three.scene.fog;
        },
        set: function(v) {
            this.three.scene.fog = v;
        },
    });
    tm.hybrid.Scene.prototype.accessor("fogColor", {
        get: function() {
            return this.three.scene.fog.color;
        },
        set: function(v) {
            this.three.scene.fog.color = v;
        },
    });
    tm.hybrid.Scene.prototype.accessor("fogNear", {
        get: function() {
            return this.three.scene.fog.near;
        },
        set: function(v) {
            this.three.scene.fog.near = v;
        },
    });
    tm.hybrid.Scene.prototype.accessor("fogFar", {
        get: function() {
            return this.three.scene.fog.far;
        },
        set: function(v) {
            this.three.scene.fog.far = v;
        },
    });

    tm.hybrid.Scene.prototype.accessor("overrideMaterial", {
        get: function() {
            return this.three.scene.overrideMaterial;
        },
        set: function(v) {
            this.three.scene.overrideMaterial = v;
        },
    });

    tm.hybrid.Scene.prototype.accessor("autoUpdate", {
        get: function() {
            return this.three.scene.autoUpdate;
        },
        set: function(v) {
            this.three.scene.autoUpdate = v;
        },
    });

    tm.define("tm.hybrid.Scene.Three", {
        superClass: "tm.hybrid.ThreeElement",

        init: function() {
            this.superInit(new THREE.Scene());

            this.scene = this.threeObject;
            this.scene.fog = new THREE.Fog(0xffffff, 1000, 5000);

            this.camera = tm.hybrid.Camera();
            this.camera.z = 7;

            this.ambientLight = tm.hybrid.AmbientLight(0x888888)
                .addChildTo(this);

            this.directionalLight = tm.hybrid.DirectionalLight(0xffffff, 1)
                .setPosition(1, 1, 1)
                .addChildTo(this);
        },
    });
})();

/*
 * hybridapp.js
 */

(function() {
    // var tm = require("../../../libs/tmlib");
    // var THREE = require("../../../libs/three");
    // require("./scene");

    tm.define("tm.hybrid.Application", {
        superClass: "tm.display.CanvasApp",

        threeRenderer: null,
        threeCanvas: null,

        init: function(canvas2d, canvas3d) {
            this.superInit(canvas2d);
            this.setupThree(canvas3d);
            this.background = "transparent";

            this.replaceScene(tm.hybrid.Scene())
        },

        setupThree: function(canvas3d) {
            var param = {
                antialias: true,
            };
            if (canvas3d) {
                if (canvas3d instanceof HTMLCanvasElement) {
                    param.canvas = canvas3d;
                } else if (typeof canvas3d === "string") {
                    param.canvas = document.querySelector(canvas3d);
                }
            }
            this.threeRenderer = new THREE.WebGLRenderer(param);
            this.threeRenderer.setClearColor("0x000000");

            // if (this.element.parentNode) {
            //     this.element.parentNode.insertBefore(this.threeRenderer.domElement, this.element);
            // } else {
            //     window.document.body.appendChild(this.threeRenderer.domElement);
            // }

            this.threeCanvas = this.threeRenderer.domElement;
        },

        /** @override */
        fitWindow: function(everFlag) {
            var _fitFunc = function() {
                everFlag = everFlag === undefined ? true : everFlag;
                var e = this.threeCanvas;
                var s = e.style;

                s.position = "absolute";
                s.margin = "auto";
                s.left = "0px";
                s.top = "0px";
                s.bottom = "0px";
                s.right = "0px";

                var rateWidth = e.width / window.innerWidth;
                var rateHeight = e.height / window.innerHeight;
                var rate = e.height / e.width;

                if (rateWidth > rateHeight) {
                    s.width = innerWidth + "px";
                    s.height = innerWidth * rate + "px";
                } else {
                    s.width = innerHeight / rate + "px";
                    s.height = innerHeight + "px";
                }
            }.bind(this);

            // 一度実行しておく
            _fitFunc();
            // リサイズ時のリスナとして登録しておく
            if (everFlag) {
                window.addEventListener("resize", _fitFunc, false);
            }

            return tm.display.CanvasApp.prototype.fitWindow.call(this, everFlag);
        },

        /** @override */
        _update: function() {
            tm.app.CanvasApp.prototype._update.call(this);
            var scene = this.currentScene;
            if (this.awake && scene instanceof tm.hybrid.Scene) {
                this.updater.update(scene.three.camera);
                this.updater.update(scene.three);
            }
        },

        /** @override */
        _draw: function() {
            tm.display.CanvasApp.prototype._draw.call(this);
            var scene = this.currentScene;
            if (scene instanceof tm.hybrid.Scene) {
                scene.render(this.threeRenderer);
            }
        },

        /** @override */
        resize: function(w, h) {
            this.threeRenderer.setSize(w, h);
            var scene = this.currentScene;
            if (scene instanceof tm.hybrid.Scene) {
                scene.three.camera.aspect = w / h;
            }
            return tm.display.CanvasApp.prototype.resize.call(this, w, h);
        }
    });
})();

/*
 * colorconv.js
 */

(function() {
    // var tm = require("../../../libs/tmlib");
    // var THREE = require("../../../libs/three");

    tm.hybrid = tm.hybrid || {};

    tm.hybrid.ColorConv = {
        hsl: function(h, s, l) {
            if (arguments.length === 1 && typeof(arguments[0]) === "string") {
                var m = arguments[0].split(" ").join("").match(/hsl\((\d+),(\d+)%,(\d+)%\)/);
                if (m) {
                    h = m[1];
                    s = m[2];
                    l = m[3];
                } else {
                    throw new Error("invalid argument " + arguments[0]);
                }
            }
            return new THREE.Color().setHSL(h / 360, s / 100, l / 100).getHex();
        },
    };
})();

/*
 * ambientlight.js
 */

(function() {
    // var tm = require("../../../libs/tmlib");
    // var THREE = require("../../../libs/three");
    // require("./delegateutil");
    // require("./threeelement");

    tm.define("tm.hybrid.AmbientLight", {
        superClass: "tm.hybrid.ThreeElement",

        init: function(hex) {
            hex = hex || 0xffffff;
            this.superInit(new THREE.AmbientLight(hex));
        },
    });

    var delegater = tm.hybrid.DelegateUtil(tm.hybrid.AmbientLight);

    delegater.property("color");
})();

/*
 * directionallight.js
 */

(function() {
    // var tm = require("../../../libs/tmlib");
    // var THREE = require("../../../libs/three");
    // require("./delegateutil");
    // require("./threeelement");

    tm.define("tm.hybrid.DirectionalLight", {
        superClass: "tm.hybrid.ThreeElement",

        init: function(hex, intensity) {
            hex = hex || 0xffffff;
            intensity = intensity || 1.0;
            this.superInit(new THREE.DirectionalLight(hex, intensity));
        },
    });

    var delegater = tm.hybrid.DelegateUtil(tm.hybrid.DirectionalLight);

    delegater.property("target");
    delegater.property("intensity");
    delegater.property("onlyShadow");
    delegater.property("shadowCameraNear");
    delegater.property("shadowCameraFar");
    delegater.property("shadowCameraLeft");
    delegater.property("shadowCameraRight");
    delegater.property("shadowCameraTop");
    delegater.property("shadowCameraBottom");
    delegater.property("shadowCameraVisible");
    delegater.property("shadowBias");
    delegater.property("shadowDarkness");
    delegater.property("shadowMapWidth");
    delegater.property("shadowMapHeight");
    delegater.property("shadowCascade");
    delegater.property("shadowCascadeOffset");
    delegater.property("shadowCascadeCount");
    delegater.property("shadowCascadeBias");
    delegater.property("shadowCascadeWidth");
    delegater.property("shadowCascadeHeight");
    delegater.property("shadowCascadeNearZ");
    delegater.property("shadowCascadeFarZ");
    delegater.property("shadowCascadeArray");
    delegater.property("shadowMap");
    delegater.property("shadowMapSize");
    delegater.property("shadowCamera");
    delegater.property("shadowMatrix");
})();

/*
 * utils.js
 */

(function() {
    // var tm = require("../../../libs/tmlib");
    // var THREE = require("../../../libs/three");

    tm.hybrid = tm.hybrid || {};

    tm.hybrid.Utils = {
        
    };
})();

(function() {
    // var tm = require("../../../libs/tmlib");
    // var THREE = require("../../../libs/three");

    tm.asset = tm.asset || {};

    tm.define("tm.asset.ThreeJSON", {
        superClass: "tm.event.EventDispatcher",

        init: function(path) {
            this.superInit();
            this.mesh = null;

            if (tm.asset.ThreeJSON.loader === null) {
                tm.asset.ThreeJSON.loader = new THREE.JSONLoader();
            }

            tm.asset.ThreeJSON.loader.load(path, function(geometry, materials) {
                this.build(geometry, materials);
                this.flare("load");
            }.bind(this));
        },

        build: function(geometry, materials) {
            materials.forEach(function(m) {
                m.shading = THREE.FlatShading;
            });
            this.mesh = new THREE.Mesh(geometry, new THREE.MeshFaceMaterial(materials));
        },
    });
    tm.asset.ThreeJSON.loader = null;

    tm.asset.Loader.register("three", function(path) {
        return tm.asset.ThreeJSON(path);
    });

})();
