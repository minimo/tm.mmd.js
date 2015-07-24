/*
 * pmd.js
 */

(function() {
    tm.asset = tm.asset || {};

    tm.define("tm.asset.PMD", {
        superClass: "tm.event.EventDispatcher",

        init: function(path) {
            this.pmd = null;
            this.texturePath = null;
            this.superInit();
            this.load(path);
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
            this.dv = DataView(data);
            this.offset = 0;
            this.pmd = this._parse(data);
            this.flare("load");
        },

        _parse: function(data) {
        },
    });

    //ローダーに拡張子登録
    tm.asset.Loader.register("pmd", function(path) {
        return tm.asset.PMD(path);
    });

    tm.define("DataViewEx", {
        init: function(buffer) {
            this.dv = DataView(buffer);
            this.offset = 0;
        },
        getInt8: function() {
            var value = this.dv.getInt8(this.offset);
            this.offset += 1;
            return value;
        },
        getUint8: function() {
            var value = this.dv.getUint8(this.offset);
            this.offset += 1;
            return value;
        },
        getInt16: function() {
            var value = this.dv.getInt16( this.offset, this.littleEndian );
            this.offset += 2;
            return value;
        },
        getUint16: function() {
            var value = this.dv.getUint16( this.offset, this.littleEndian );
            this.offset += 2;
            return value;
        },
        getInt32: function() {
            var value = this.dv.getInt32( this.offset, this.littleEndian );
            this.offset += 4;
            return value;
        },
        getUint32: function() {
            var value = this.dv.getUint32( this.offset, this.littleEndian );
            this.offset += 4;
            return value;
        },
        getFloat32: function() {
            var value = this.dv.getFloat32( this.offset, this.littleEndian );
            this.offset += 4;
            return value;
        },
        getFloat64: function() {
            var value = this.dv.getFloat64( this.offset, this.littleEndian );
            this.offset += 8;
            return value;
        },
        getChars: function(size) {
            var str = '';
            while (size > 0) {
                var value = this.getUint8();
                size--;
                if( value === 0 ) break;
                str += String.fromCharCode( value );
            }
            while (size>0) {
                this.getUint8();
                size--;
            }
            return str;
        },

        // using temporal workaround because Shift_JIS binary -> utf conversion isn't so easy.
        // Shift_JIS binary will be converted to hex strings with prefix '0x' on each byte.
        // for example Shift_JIS 'あいうえお' will be '0x82x0xa00x820xa20x800xa40x820xa60x820xa8'.
        // functions which handle Shift_JIS data (ex: bone name check) need to know this trick.
        // TODO: Shift_JIS support (by using http://imaya.blog.jp/archives/6368510.html)
        getSjisStrings: function(size) {
            var str = '';
            while (size>0) {
                var value = this.getUint8();
                size--;
                if ( value === 0 ) break;
                str += '0x' + ( '0' + value.toString( 16 ) ).substr( -2 );
            }
            while (size>0) {
                this.getUint8();
                size--;
            }
            return str;
        }
    });

})();
