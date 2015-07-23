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

        /**
         * @constructor tm.hybrid.ThreeElement
         * @param {THREE.Object3D} threeObject
         * @extends {tm.app.Element}
         * @mixes THREE.Object3D
         *
         * @property {number} x
         * @property {number} y
         * @property {number} z
         * @property {number} scaleX
         * @property {number} scaleY
         * @property {number} scaleZ
         * @property {number} rotationX
         * @property {number} rotationY
         * @property {number} rotationZ
         * @property {THREE.Vector3} forwardVector readonly
         * @property {THREE.Vector3} sidewardVector readonly
         * @property {THREE.Vector3} upwardVector readonly
         */
        init: function(threeObject) {
            this.superInit();

            this.threeObject = threeObject || new THREE.Object3D();
        },

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

        /**
         * @method
         * @memberOf tm.hybrid.ThreeElement.prototype
         * @param {number} x
         * @param {number} y
         * @param {number} z
         */
        setPosition: function(x, y, z) {
            this.x = x;
            this.y = y;
            this.z = z;
            return this;
        },

        /**
         * @method
         * @memberOf tm.hybrid.ThreeElement.prototype
         * @param {number} delta
         */
        ahead: function(delta) {
            this.threeObject.position.add(this.forwardVector.multiplyScalar(delta));
            return this;
        },
        /**
         * @method
         * @memberOf tm.hybrid.ThreeElement.prototype
         * @param {number} delta
         */
        sideStep: function(delta) {
            this.threeObject.position.add(this.sidewardVector.multiplyScalar(delta));
            return this;
        },
        /**
         * @method
         * @memberOf tm.hybrid.ThreeElement.prototype
         * @param {number} delta
         */
        elevate: function(delta) {
            this.threeObject.position.add(this.upwardVector.multiplyScalar(delta));
            return this;
        },

        /**
         * @method
         * @memberOf tm.hybrid.ThreeElement.prototype
         * @param {number} x
         * @param {number} y
         * @param {number} z
         */
        setRotation: function(x, y, z) {
            this.rotationX = x;
            this.rotationY = y;
            this.rotationZ = z;
            return this;
        },
        /**
         * @method
         * @memberOf tm.hybrid.ThreeElement.prototype
         * @param {number} x
         */
        setRotationX: function(x) {
            this.rotationX = x;
            return this;
        },
        /**
         * @method
         * @memberOf tm.hybrid.ThreeElement.prototype
         * @param {number} y
         */
        setRotationY: function(y) {
            this.rotationY = y;
            return this;
        },
        /**
         * @method
         * @memberOf tm.hybrid.ThreeElement.prototype
         * @param {number} z
         */
        setRotationZ: function(z) {
            this.rotationZ = z;
            return this;
        },

        /**
         * @method
         * @memberOf tm.hybrid.ThreeElement.prototype
         * @param {number} degree
         */
        rotatePitch: function(degree) {
            var q = tempQuat.setFromAxisAngle(V3_RIGHT, degree * Math.DEG_TO_RAD);
            this.quaternion.multiply(q);
            return this;
        },
        /**
         * @method
         * @memberOf tm.hybrid.ThreeElement.prototype
         * @param {number} degree
         */
        rotateYaw: function(degree) {
            var q = tempQuat.setFromAxisAngle(V3_UP, degree * Math.DEG_TO_RAD);
            this.quaternion.multiply(q);
            return this;
        },
        /**
         * @method
         * @memberOf tm.hybrid.ThreeElement.prototype
         * @param {number} degree
         */
        rotateRoll: function(degree) {
            var q = tempQuat.setFromAxisAngle(V3_FORWARD, degree * Math.DEG_TO_RAD);
            this.quaternion.multiply(q);
            return this;
        },

        /**
         * @memberOf tm.hybrid.ThreeElement.prototype
         * @param {number} x
         * @param {number=} y
         * @param {number=} z
         */
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

    tm.hybrid.ThreeElement.prototype.getter("forwardVector", function() {
        if (this._forwardVector == null) this._forwardVector = new THREE.Vector3();
        this._forwardVector.set(0, 0, 1);
        this._forwardVector.applyQuaternion(this.quaternion);
        return this._forwardVector;
    });
    tm.hybrid.ThreeElement.prototype.getter("sidewardVector", function() {
        if (this._sidewardVector == null) this._sidewardVector = new THREE.Vector3();
        this._sidewardVector.set(1, 0, 0);
        this._sidewardVector.applyQuaternion(this.quaternion);
        return this._sidewardVector;
    });
    tm.hybrid.ThreeElement.prototype.getter("upwardVector", function() {
        if (this._upVector == null) this._upVector = new THREE.Vector3();
        this._upVector.set(0, 1, 0);
        this._upVector.applyQuaternion(this.quaternion);
        return this._upVector;
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
    tm.hybrid.ThreeElement.prototype.globalToLocal = tm.hybrid.ThreeElement.prototype.worldToLocal;

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

        /**
         * @constructor tm.hybrid.Mesh
         * @param {THREE.Mesh} mesh
         * @extends {tm.hybrid.ThreeElement}
         * @mixes THREE.Mesh
         */
        init: function(mesh) {
            if (typeof(mesh) === "string") {
                var asset = tm.asset.Manager.get(mesh);
                if (asset) {
                    if (asset instanceof tm.asset.ThreeJSON) {
                        this.superInit(asset.mesh.clone());
                    } else if (asset instanceof tm.asset.Vox) {
                        this.superInit(asset.mesh.clone());
                    } else if (asset instanceof tm.asset.MQO) {
                        this.superInit(asset.model.meshes[0]);
                        for (var i = 1; i < asset.model.meshes.length; i++) {
                            tm.hybrid.Mesh(asset.model.meshes[i]).addChildTo(this);
                        }
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
    });

    var delegater = tm.hybrid.DelegateUtil(tm.hybrid.Mesh);

    /**
     * @method
     * @memberOf tm.hybrid.Mesh.prototype
     * @param {THREE.Geometry} geometry
     * @returns this
     */
    function setGeometry() {}
    delegater.property("geometry");

    /**
     * @method
     * @memberOf tm.hybrid.Mesh.prototype
     * @param {THREE.Material} material
     * @returns this
     */
    function setMaterial() {}
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

        /**
         * @constructor tm.hybrid.Scene
         * @extends {tm.app.Scene}
         * @mixes THREE.Scene
         *
         * @property {THREE.PerspectiveCamera} camera
         * @property {THREE.DirectionalLight} directionalLight
         * @property {THREE.AmbientLight} ambientLight
         * @property {THREE.EffectComposer} effectComposer
         * @property {THREE.Color} fogColor
         * @property {number} fogNear
         * @property {number} fogFar
         * @property {Object} two
         * @property {Object} three
         */
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
            if (this.effectComposer) {
                this.effectComposer.render();
            } else {
                renderer.render(this.three.scene, this.three.camera.threeObject);
            }
        },

        addChild: function(child) {
            if (child instanceof tm.hybrid.ThreeElement) {
                this.three.addChild(child);
            } else {
                tm.app.Scene.prototype.addChild.call(this, child);
            }
        },

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

/** @namespace */
var tm = tm || {};
/** @namespace */
tm.hybrid = tm.hybrid || {};

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

        /**
         * @constructor tm.hybrid.Application
         * @param {HTMLCanvasElement|String} canvas2d canvas element or id for draw 2d graphics
         * @param {HTMLCanvasElement|String} canvas3d canvas element or id for draw 3d graphics
         * @extends {tm.display.CanvasApp}
         *
         * @property {THREE.WebGLRenderer} threeRenderer
         * @property {HTMLCanvasElement} threeCanvas
         */
        init: function(canvas2d, canvas3d) {
            this.superInit(canvas2d);
            this.setupThree(canvas3d);
            this.background = "transparent";

            this.replaceScene(tm.hybrid.Scene())
        },

        /**
         * @memberOf tm.hybrid.Application.prototype
         * @private
         */
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

        _update: function() {
            tm.app.CanvasApp.prototype._update.call(this);
            var scene = this.currentScene;
            if (this.awake && scene instanceof tm.hybrid.Scene) {
                this.updater.update(scene.three.camera);
                this.updater.update(scene.three);
            }
        },

        _draw: function() {
            tm.display.CanvasApp.prototype._draw.call(this);
            var scene = this.currentScene;
            if (scene instanceof tm.hybrid.Scene) {
                scene.render(this.threeRenderer);
            }
        },

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

var tm = tm || {};
/** @namespace */
tm.asset = tm.asset || {};

(function() {
    // var tm = require("../../../libs/tmlib");
    // var THREE = require("../../../libs/three");

    tm.asset = tm.asset || {};

    tm.define("tm.asset.ThreeJSON", {
        superClass: "tm.event.EventDispatcher",

        /**
         * @constructor tm.asset.ThreeJSON
         * @extends {tm.event.EventDispatcher}
         */
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

var tm = tm || {};
/** @namespace */
tm.asset = tm.asset || {};

(function() {
    // var tm = require("../../../libs/tmlib");
    // var THREE = require("../../../libs/three");

    tm.asset = tm.asset || {};

    tm.define("tm.asset.Vox", {
        superClass: "tm.event.EventDispatcher",

        /**
         * usage:
         * tm.asset.LoadingScene({ assets: { vox: "test.vox" } });
         *
         * @constructor tm.asset.Vox
         * @extends {tm.event.EventDispatcher}
         */
        init: function(path) {
            this.superInit();

            this.mesh = null;

            if (tm.asset.Vox.parser === null) {
                tm.asset.Vox.parser = new vox.Parser();
            }

            tm.asset.Vox.parser.parse(path).then(function(voxelData) {
                var builder = new vox.MeshBuilder(voxelData);
                this.mesh = builder.createMesh();
                this.flare("load");
            }.bind(this));
        },
    });
    tm.asset.Vox.parser = null;

    tm.asset.Loader.register("vox", function(path) {
        return tm.asset.Vox(path);
    });

})();

(function() {
    tm.asset = tm.asset || {};

    _modelPath = "";

    tm.define("tm.asset.MQO", {
        superClass: "tm.event.EventDispatcher",

        model: null,

        init: function(path) {
            this.superInit();
            this.loadFromURL(path);
        },

        // URLからロード
        loadFromURL: function(path) {
            var modelurl = path.split("/");
            _modelPath = "";
            for (var i = 0, len = modelurl.length; i < len-1; i++) {
                _modelPath += modelurl[i];
            }

            var that = this;
            var req = new XMLHttpRequest();
            req.open("GET", path, true);
            req.onload = function() {
                var data = req.responseText;
                that.loadFromData(data);
            };
            req.send(null);
        },

        //データからロード
        loadFromData: function(data) {
            this.model = tm.MQOModel(data);
            this.flare("load");
        },
    });

    //ローダーに拡張子登録
    tm.asset.Loader.register("mqo", function(path) {
        return tm.asset.MQO(path);
    });

    /*
     * メタセコイアモデル
     */
    tm.define("tm.MQOModel", {
        //変換後メッシュアレイ
        meshes: [],

        //メッシュアレイ
        _rawMeshes: [],

        //マテリアルアレイ
        _rawMaterials: null,
        
        init: function(data) {
            this.meshes = [];
            this._rawMeshes = [];
            this._rawMaterials = null;
            this.parse(data);
            this.convert();
        },

        parse: function(data) {
            // マテリアル
            var materialText = data.match(/^Material [\s\S]*?^\}/m);
            this._rawMaterials = tm.MQOMaterial(materialText[0]);       //マテリアルチャンクは原則一つ

            // オブジェクト
            var objectText = data.match(/^Object [\s\S]*?^\}/gm);
            for (var i = 0, len = objectText.length; i < len; ++i) {
                var mesh = tm.MQOMesh(objectText[i]);
                this._rawMeshes.push(mesh);
            }
        },

        convert: function(){
            this.meshes = [];
            for (var i = 0, len = this._rawMeshes.length; i < len; i++) {
                var mesh = this._rawMeshes[i];
                var list = mesh.convert(this._rawMaterials);
                for (var j = 0, len2 = list.length; j < len2; j++) {
                    this.meshes.push(list[j]);
                }
            }
        },
    });

    /*
     * メタセコイアメッシュ
     */
    tm.define("tm.MQOMesh", {
        name: "",   //メッシュ名

        vertices: [],   // 頂点
        faces: [],      // 面情報
        vertNormals: [],// 頂点法線
        
        facet: 59.5,    // スムージング角度

        mirror: 0,      //ミラーリング
        mirrorAxis: 0,  //ミラーリング軸

        init: function(text) {
            this.vertices = [];
            this.faces = [];
            this.vertNormals = [];
            this.parse(text);
        },

        parse:function(text){
            //オブジェクト名
            var name = text.split(' ');
            this.name = name[1].replace(/"/g, "");

            //スムージング角
            var facet = text.match(/facet ([0-9\.]+)/);
            if( facet ){ this.facet = Number(facet[1]); }

            //可視フラグ
            var visible = text.match(/visible ([0-9\.]+)/);
            if( visible ){ this.visible = Number(visible[1]); }

            //ミラーリング
            var mirror = text.match(/mirror ([0-9])/m);
            if( mirror ){
                this.mirror = Number(mirror[1]);
                // 軸
                var mirrorAxis = text.match(/mirror_axis ([0-9])/m);
                if( mirrorAxis ){
                    this.mirrorAxis = Number(mirrorAxis[1]);
                }
            }

            //頂点情報
            var vertex_txt = text.match(/vertex ([0-9]+).+\{\s([\w\W]+)}$/gm);
            this._parseVertices( RegExp.$1, RegExp.$2 );

            //フェース情報
            var face_txt = text.match(/face ([0-9]+).+\{\s([\w\W]+)}$/gm);
            this._parseFaces( RegExp.$1, RegExp.$2 );
        },

        convert: function(materials){
            //不可視設定の場合は処理をスキップ
            if( this.visible == 0 ){
                return [];  //空の配列を返す
            }

            //フェースが使用するマテリアルを調べる
            var facemat = [];
            facemat[facemat.length] = this.faces[0].m[0];
            for (var i = 0, lf = this.faces.length; i < lf; i++) {
                var fm = this.faces[i].m[0];
                for (var j = 0, lfm = facemat.length; j < lfm; j++) {
                    if( facemat[j] == this.faces[i].m[0] )fm = -1;
                }
                if( fm != -1 )facemat.push(fm);
            }

            //使用マテリアルに応じてオブジェクトを分割変換
            var meshList = []
            for (var mn = 0; mn < facemat.length; mn++) {
                var matnum = facemat[mn];
                var sp = this.build(matnum, materials.materials[matnum]);
                if (sp) meshList.push(sp);
            }
            return meshList;
        },

        /*
         * フェース情報からマテリアルに対応した頂点情報を構築
         * THREE形式専用
         */
        build: function(num, mqoMat) {
            //マテリアル情報
            var mat = null;
            if (mqoMat) {
                //シェーダーパラメータによってマテリアルを使い分ける
                if(mqoMat.shader === undefined) {
                    mat = new THREE.MeshPhongMaterial();
                } else if(mqoMat.shader == 2) {
                    mat = new THREE.MeshLambertMaterial();
                } else if(mqoMat.shader == 3) {
                    mat = new THREE.MeshPhongMaterial();
                } else  {
                    mat = new THREE.MeshBasicMaterial();
                }
                var r = mqoMat.col[0];
                var g = mqoMat.col[1];
                var b = mqoMat.col[2];
//                if (mat.color) mat.color.setRGB(r*mqoMat.dif, g*mqoMat.dif, b*mqoMat.dif);
                if (mat.color) mat.color.setRGB(r, g, b);
                if (mat.emissive) mat.emissive.setRGB(r*mqoMat.emi*0.1, g*mqoMat.emi*0.1, b*mqoMat.emi*0.1);
                if (mat.ambient) mat.ambient.setRGB(r*mqoMat.amb, g*mqoMat.amb, b*mqoMat.amb);
                if (mat.specular) mat.specular.setRGB(r*mqoMat.spc, g*mqoMat.spc, b*mqoMat.spc);
                if (mqoMat.tex) {
                    mat.map = THREE.ImageUtils.loadTexture(_modelPath+"/"+mqoMat.tex);
                }
                mat.transparent = true;
                mat.shiness = mqoMat.power;
                mat.opacity = mqoMat.col[3];
            } else {
                //デフォルトマテリアル
                mat = new THREE.MeshBasicMaterial();
                mat.color.setRGB(0.7, 0.7, 0.7);
                mat.transparent = true;
                mat.shiness = 1.0;
            }

            //ジオメトリ情報
            var geo = new THREE.Geometry();

            //頂点情報初期化
            for(var i = 0; i < this.vertices.length; i++) {
                this.vertices[i].to = -1;
            }
            var countVertex = 0;

            //インデックス情報
            for (var i = 0, len = this.faces.length; i < len; i++) {
                var face = this.faces[i];
                if (face.m != num) continue;
                if (face.vNum < 3) continue;

                var vIndex = face.v;
                if (face.vNum == 3) {
                    //法線
                    var nx = face.n[0];
                    var ny = face.n[1];
                    var nz = face.n[2];
                    var normal =  new THREE.Vector3(nx, ny, nz);

                    //フェース情報
                    var index = [];
                    index[0] = vIndex[2];
                    index[1] = vIndex[1];
                    index[2] = vIndex[0];
                    for (var j = 0; j < 3; j++) {
                        var v = this.vertices[index[j]];
                        if (v.to != -1) {
                            index[j] = v.to;
                        } else {
                            v.to = countVertex;
                            index[j] = v.to;
                            countVertex++;
                        }
                    }
                    var face3 = new THREE.Face3(index[0], index[1], index[2], normal, undefined, face.m[0]);

                    //頂点法線
                    face3.vertexNormals.push(normal);
                    face3.vertexNormals.push(normal);
                    face3.vertexNormals.push(normal);

                    geo.faces.push(face3);

                    // ＵＶ座標
                    geo.faceVertexUvs[0].push([
                        new THREE.Vector2(face.uv[4], 1.0 - face.uv[5]),
                        new THREE.Vector2(face.uv[2], 1.0 - face.uv[3]),
                        new THREE.Vector2(face.uv[0], 1.0 - face.uv[1])]);
                } else if (face.vNum == 4) {
                    //法線
                    var nx = face.n[0];
                    var ny = face.n[1];
                    var nz = face.n[2];
                    var normal =  new THREE.Vector3(nx, ny, nz);

                    //四角を三角に分割
                    {
                        //フェース情報
                        var index = [];
                        index[0] = vIndex[3];
                        index[1] = vIndex[2];
                        index[2] = vIndex[1];
                        for (var j = 0; j < 3; j++) {
                            var v = this.vertices[index[j]];
                            if (v.to != -1) {
                                index[j] = v.to;
                            } else {
                                v.to = countVertex;
                                index[j] = v.to;
                                countVertex++;
                            }
                        }
                        var face3 = new THREE.Face3(index[0], index[1], index[2], normal, undefined, face.m[0]);
//                        var face3 = new THREE.Face3(vIndex[3], vIndex[2], vIndex[1], normal, undefined, face.m[0]);

                        //頂点法線
                        face3.vertexNormals.push(normal);
                        face3.vertexNormals.push(normal);
                        face3.vertexNormals.push(normal);

                        geo.faces.push(face3);

                        // ＵＶ座標
                        geo.faceVertexUvs[0].push([
                            new THREE.Vector2(face.uv[6], 1.0 - face.uv[7]),
                            new THREE.Vector2(face.uv[4], 1.0 - face.uv[5]),
                            new THREE.Vector2(face.uv[2], 1.0 - face.uv[3])]);
                    }
                    {
                        //フェース情報
                        var index = [];
                        index[0] = vIndex[1];
                        index[1] = vIndex[0];
                        index[2] = vIndex[3];
                        for (var j = 0; j < 3; j++) {
                            var v = this.vertices[index[j]];
                            if (v.to != -1) {
                                index[j] = v.to;
                            } else {
                                v.to = countVertex;
                                index[j] = v.to;
                                countVertex++;
                            }
                        }
                        var face3 = new THREE.Face3(index[0], index[1], index[2], normal, undefined, face.m[0]);
//                        var face3 = new THREE.Face3(vIndex[1], vIndex[0], vIndex[3], normal, undefined, face.m[0]);

                        //頂点法線
                        face3.vertexNormals.push(normal);
                        face3.vertexNormals.push(normal);
                        face3.vertexNormals.push(normal);

                        geo.faces.push(face3);

                        // ＵＶ座標
                        geo.faceVertexUvs[0].push([
                            new THREE.Vector2(face.uv[2], 1.0 - face.uv[3]),
                            new THREE.Vector2(face.uv[0], 1.0 - face.uv[1]),
                            new THREE.Vector2(face.uv[6], 1.0 - face.uv[7])]);
                    }
                }
            }

            //頂点情報
            var scale = 1;
            this.vertices.sort(function(a, b) {
                return a.to - b.to;
            });
            for(var i = 0; i < this.vertices.length; i++) {
                var v = this.vertices[i];
                if (v.to != -1) {
                    var x = v.x*scale;
                    var y = v.y*scale;
                    var z = v.z*scale;
                    geo.vertices.push(new THREE.Vector3(x, y, z));
                }
            }


            //各種情報計算
            geo.computeBoundingBox();
            geo.computeFaceNormals();
            geo.computeVertexNormals();

            //メッシュ生成
            var obj = new THREE.Mesh(geo, mat);
            return obj;
        },

        //頂点情報のパース
        _parseVertices: function(num, text) {
            var scale = 0.1;
            var vertexTextList = text.split('\n');
            for (var i = 0; i <= num; i++) {
                var vertex = vertexTextList[i].split(' ');
                if (vertex.length < 3)continue;
                var v = {};
                v.x = Number(vertex[0])*scale;
                v.y = Number(vertex[1])*scale;
                v.z = Number(vertex[2])*scale;
                this.vertices.push(v);
            }

            //ミラーリング対応
            if (this.mirror) {
                var self = this;
                var toMirror = (function(){
                    return {
                        1: function(v) { return [ v[0]*-1, v[1], v[2] ]; },
                        2: function(v) { return [ v[0], v[1]*-1, v[2] ]; },
                        4: function(v) { return [ v[0], v[1], v[2]*-1 ]; },
                    }[self.mirrorAxis];
                })();
                var len = this.vertices.length;
                for (var i = 0; i < len; i++) {
                    this.vertices.push(toMirror(this.vertices[i]));
                }
            }
        },

        //フェース情報のパース
        _parseFaces: function(num, text) {
            var faceTextList = text.split('\n');

            //法線計算
            var calcNormalize = function(a, b, c) {
                var v1 = [ a[0] - b[0], a[1] - b[1], a[2] - b[2] ];
                var v2 = [ c[0] - b[0], c[1] - b[1], c[2] - b[2] ];
                var v3 = [
                    v1[1]*v2[2] - v1[2]*v2[1],
                    v1[2]*v2[0] - v1[0]*v2[2],
                    v1[0]*v2[1] - v1[1]*v2[0]
                ];
                var len = Math.sqrt(v3[0]*v3[0] + v3[1]*v3[1] + v3[2]*v3[2]);
                v3[0] /= len;
                v3[1] /= len;
                v3[2] /= len;

                return v3;
            };

            for (var i = 0; i <= num; i++ ){
                // トリムっとく
                var faceText = faceTextList[i].replace(/^\s+|\s+$/g, "");
                // 面の数
                var vertex_num = Number(faceText[0]);

                var info = faceText.match(/([A-Za-z]+)\(([\w\s\-\.\(\)]+?)\)/gi);
                var face = { vNum: vertex_num };
                if (!info) continue;
                
                for (var j = 0, len = info.length; j < len; j++) {
                    var m = info[j].match(/([A-Za-z]+)\(([\w\s\-\.\(\)]+?)\)/);
                    var key = m[1].toLowerCase();
                    var value = m[2].split(" ");
                    value.forEach(function(elm, i, arr){
                        arr[i] = Number(elm);
                    });
                    face[key] = value;
                }
                
                // UV デフォルト値
                if (!face.uv) {
                    face.uv = [0, 0, 0, 0, 0, 0, 0, 0];
                }

                // マテリアル デフォルト値
                if (!face.m) {
                    face.m = [undefined];
                }

                // 法線（面の場合のみ）
                if (face.v.length > 2) {
                    face.n = calcNormalize(this.vertices[face.v[0]], this.vertices[face.v[1]], this.vertices[face.v[2]]);
                }

                this.faces.push(face);
            }

            // ミラーリング対応
            if( this.mirror ){
                var swap = function(a,b){ var temp = this[a]; this[a] = this[b]; this[b] = temp; return this; };
                var len = this.faces.length;
                var vertexOffset = (this.vertices.length/2);
                for(var i = 0; i < len; i++) {
                    var targetFace = this.faces[i];
                    var face = {
                        uv  : [],
                        v   : [],
                        vNum: targetFace.vNum,
                    };
                    for (var j = 0; j < targetFace.v.length; j++) { face.v[j] = targetFace.v[j] + vertexOffset; }
                    for (var j = 0; j < targetFace.uv.length; j++) { face.uv[j] = targetFace.uv[j]; }

                    if (face.vNum == 3) {
                        swap.call(face.v, 1, 2);
                    } else {
                        swap.call(face.v, 0, 1);
                        swap.call(face.v, 2, 3);
                    }

                    face.n = targetFace.n;
                    face.m = targetFace.m;

                    this.faces.push(face);
                }
            }

            // 頂点法線を求める
            var vertNormal = Array(this.vertices.length);
            for (var i = 0, len = this.vertices.length; i < len; i++) vertNormal[i] = [];

            for (var i = 0; i < this.faces.length; i++) {
                var face = this.faces[i];
                var vIndices = face.v;

                for (var j = 0; j < face.vNum; j++) {
                    var index = vIndices[j];
                    vertNormal[index].push.apply(vertNormal[index], face.n);
                }
            }

            for (var i = 0; i < vertNormal.length; i++) {
                var vn = vertNormal[i];
                var result = [0, 0, 0];
                var len = vn.length/3;
                for (var j = 0; j < len; j++) {
                    result[0] += vn[j*3+0];
                    result[1] += vn[j*3+1];
                    result[2] += vn[j*3+2];
                }

                result[0] /= len;
                result[1] /= len;
                result[2] /= len;

                var len = Math.sqrt(result[0]*result[0] + result[1]*result[1] + result[2]*result[2]);
                result[0] /= len;
                result[1] /= len;
                result[2] /= len;
                
                this.vertNormals[i] = result;
            }
        },
    });

    /*
     * メタセコイアマテリアル
     */
    tm.define("tm.MQOMaterial", {
        materials: [],

        init: function(data) {
            this.materials = [];
            this.parse(data);
        },

        //マテリアル情報のパース
        parse: function(data) {
//            var infoText    = data.match(/^Material [0-9]* \{\r\n([\s\S]*?)\r\n^\}$/m);
//            var matTextList = infoText[1].split('\n');
            var matTextList = data.split('\n');

            for (var i = 1, len = matTextList.length-1; i < len; i++) {
                var mat = {};
                // トリムっとく
                var matText = matTextList[i].replace(/^\s+|\s+$/g, "");
                var info = matText.match(/([A-Za-z]+)\(([\w\W]+?)\)/gi);    //マテリアル情報一個分抜く

                var nl = matText.split(' ');    //マテリアル名取得
                mat['name'] = nl[0].replace(/"/g, "");

                for( var j = 0, len2 = info.length; j < len2; j++ ){
                    var m = info[j].match(/([A-Za-z]+)\(([\w\W]+?)\)/); //要素を抜き出す
                    var key = m[1].toLowerCase();   //文字列小文字化
                    var value = null;

                    if( key != "tex" && key != "aplane" ){
                        //テクスチャ以外の要素
                        value = m[2].split(" ");
                        value.forEach(function(elm, i, arr){
                            arr[i] = Number(elm);
                        });
                    }else{
                        //テクスチャの場合
                        value = m[2].replace(/"/g, "");
                    }
                    mat[key] = value;
                }
                this.materials.push(mat);
            }
        },
        convert: function() {
        },
    });

})();

