tm.main(function() {
    var app = tm.hybrid.Application("#canvas2d", "#canvas3d");
    app.resize(640, 960).fitWindow().run();
    
    app.replaceScene(tm.game.LoadingScene({
        width: 640, height: 960,
        assets: {
            hiyoko: "assets/hiyoco_nomal_full.png",
        },
        nextScene: KiraraOnStage,
    }));
});

tm.define("KiraraOnStage", {
    superClass: "tm.hybrid.Scene", // tm.app.Sceneの3D向け拡張
    init: function() {
        this.superInit();

        // カメラ調整
        this.camera.setPosition(0, 0, 2000);
        this.camera.lookAt(new THREE.Vector3(0, 10, 0));
        
        // ライトを動かす
        this.directionalLight.setPosition(0, 100, -80);
/*
        this.directionalLight
            .on("enterframe", function(e) {
                var f = e.app.frame;
                this.x = Math.cos(f * 0.1) * 10;
                this.z = Math.sin(f * 0.1) * 10;
            });
*/
        var sx = 20, sy = 20;
        var texture = THREE.ImageUtils.loadTexture('assets/tmlib_logo.png');
        var geometry = new THREE.PlaneGeometry(1000, 1000, sx, sy);
        var material = new THREE.MeshLambertMaterial({map: texture, side: THREE.DoubleSide});
        this.planeMesh = new THREE.Mesh(geometry, material);
        this.planeMesh.sx = sx;
        this.planeMesh.sy = sy;

        // メッシュを表示する
        var kirara = tm.hybrid.Mesh(this.planeMesh)
            .addChildTo(this)
            .setPosition(0, 0, 0)
            .on("enterframe", function() {
                if (this.rolling) this.rotationY += 5; // Y軸回転
            });
        kirara.rolling = false;

        // 2Dスプライトとの併用も可能
        var hiyoko = tm.display.Sprite("hiyoko", 32, 32)
            .setScale(4)
            .setFrameIndex(0)
            .addChildTo(this)
            .on("enterframe", function() {
                this.x += this.vx * 10;
                this.y += this.vy * 10;
                if (this.x < 0 || 640 < this.x) this.vx *= -1;
                if (this.y < 0 || 960 < this.y) this.vy *= -1;
                
                this.frameIndex = (this.frameIndex + 1) % 4;
                this.rotation += 2;
            });
        hiyoko.vx = 1;
        hiyoko.vy = 1;

        tm.ui.FlatButton({ text: "かいてん" })
            .setPosition(320, 100)
            .addChildTo(this)
            .on("push", function() {
                kirara.rolling = !kirara.rolling;
                this.label.text = kirara.rolling ? "とまる" : "かいてん";
            });
        this.time = 0;
    },
    update: function(e) {
        var time = this.time++;

        this.planeMesh.geometry.verticesNeedUpdate = true;
        var sx = this.planeMesh.sx, sy = this.planeMesh.sy;
        for (var x = 0; x < sx+1; x++) {
            for (var y = 0; y < sy+1; y++) {
                var index = y*(sx+1)+x%(sy+1);
                var vertex = this.planeMesh.geometry.vertices[index];
                var amp = 50+500*noise.perlin3(x+time, y+time, time);
                vertex.z = amp*Math.sin(-x/2 + time/5);
            }
        }
    },
});
