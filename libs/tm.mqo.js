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

            var req = new XMLHttpRequest();
            req.open("GET", path, true);
            req.onload = function() {
                var data = req.responseText;
                that.loadFromData(data);
            };
            req.send(null);
            var that = this;
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

