tm.main(function() {
    var app = tm.hybrid.Application("#canvas2d", "#canvas3d");
    app.fps = 60;
    app.resize(640, 960).fitWindow().run();
    app.enableStats();
    
    app.replaceScene(tm.game.LoadingScene({
        width: 640, height: 960,
        assets: {
            hiyoko: "assets/hiyoco_nomal_full.png",
            bgm: "assets/smile.mp3",

            //urlをモデルデータ、モーションデータの順に指定
            //There is a need to specify the PMD and VMD together to play the MMD
            miku: {
                type: "mmd",
                url: ["assets/pmd/miku_v2.pmd", "assets/vmd/wavefile_v2.vmd"],
            },

            //分けて読み込みも可能
            mikuv2:     "assets/pmd/miku_v2.pmd",
            wavefile:   "assets/vmd/wavefile_v2.vmd",
        },
        nextScene: MikuOnStage,
    }));
});

tm.define("MikuOnStage", {
    superClass: "tm.hybrid.Scene", // tm.app.Sceneの3D向け拡張
    init: function() {
        this.superInit();

        // カメラ調整
        this.camera.setPosition(0, 20, 30);
        this.camera.lookAt(new THREE.Vector3(0, 10, 0));
        
        // ライトを動かす
        this.directionalLight.setPosition(0, 100, -80);

        // メッシュを表示する
        var miku = tm.hybrid.Mesh("miku")
            .addChildTo(this)
            .setPosition(0, 0, 0)
            .on("enterframe", function() {
                if (this.rolling) this.rotationY += 10; // Y軸回転
            });
        miku.rolling = false;

        // 2Dスプライトとの併用も可能
        var hiyoko = tm.display.Sprite("hiyoko", 32, 32)
            .setScale(4)
            .setFrameIndex(0)
//            .addChildTo(this)
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

        var btn = tm.ui.FlatButton({ text: "スタート" })
            .setPosition(320, 960*0.5)
            .addChildTo(this)
            .on("push", function() {
                btn.visible = false;
            }.bind(this));

        this.bgm = tm.asset.AssetManager.get("bgm");
        THREE.AnimationHandler.update(0);

        this.start = false;

        this.time = 0;
    },
    update: function(app) {
        if (!this.start) return;
        var t = this.bgm.context.currentTime;
        var delta = t - this.beforeTime;
        THREE.AnimationHandler.update(app.deltaTime/1000);
        this.beforeTime = t;
    },
    ontouchstart: function(e) {
        if (!this.start) {
            tm.sound.WebAudio.unlock();
            this.bgm.context.currentTime = 0;
            this.bgm.play();
            this.start = true;
            this.beforeTime = 0;
        }
    },
});
