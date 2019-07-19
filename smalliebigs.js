class SmallieBigs {
    _defaultOptions = {
        debug: false,
        maximumResolution: 3000,
        quality: 0.8,
        forceJpeg: false
    };

    constructor(options) {
        this.options = Object.assign(this._defaultOptions, options);
        this._log(`SmallieBigs contructed with options: ${JSON.stringify(this.options)}`);
    }

    _blobToArrayBuffer(blob) {
      return new Promise((resolve, reject) => {
        this._log('entering _blobToArrayBuffer');
        function _resolve(result, that) {
            that._log('exiting _blobToArrayBuffer');
            resolve(result);
        }
        let reader = new FileReader();
        reader.onload = () => {
          _resolve(reader.result, this);
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(blob);
      })
    }

    _blobToDataUrl(blob) {
      return new Promise((resolve, reject) => {
        this._log('entering _blobToDataUrl');
        function _resolve(result, that) {
            that._log('exiting _blobToDataUrl');
            resolve(result);
        }
        let reader = new FileReader();
        reader.onload = () => {
          _resolve(reader.result, this);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      })
    }

    _base64ToImage(img_b64, img_type) {
      return new Promise((resolve, reject) => {
        this._log('entering _base64ToImage');
        function _resolve(result, that) {
            that._log('exiting _base64ToImage');
            resolve(result);
        }
        let img = document.createElement('img');
        img.onerror = reject;
        img.onload = () => {
          _resolve(img, this);
        };
        img.src = 'data:' + img_type + ';base64,' + img_b64;
      });
    }

    _dataUrlToImage(dataurl) {
      return new Promise((resolve, reject) => {
        this._log('entering _dataUrlToImage');
        function _resolve(result, that) {
            that._log('exiting _dataUrlToImage');
            resolve(result);
        }
        let img = document.createElement('img');
        img.onerror = reject;
        img.onload = () => {
          _resolve(img, this);
        };
        img.src = dataurl;
      });
    }

    _canvasToBlob(canvas, type, quality, forceJpeg) {
      return new Promise((resolve, reject) => {
        this._log('entering _canvasToBlob');
        function _resolve(result, that) {
          that._log('exiting _canvasToBlob');
          resolve(result);
        }
        canvas.onerror = reject;
        canvas.toBlob((result) => _resolve(result, this), (forceJpeg) ? 'image/jpeg' : type, quality);
      });
    }

    _arrayBufferToBase64(buffer) {
        this._log('entering _arrayBufferToBase64');
        let binary = '';
        let bytes = new Uint8Array(buffer);
        let len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        let b64 = window.btoa(binary);
        this._log('exiting _arrayBufferToBase64');
        return b64;
    }

    _makeSizedCanvas(width, height, max) {
        this._log('entering _makeSizedCanvas');
        if (Math.max(width, height) > max) {
            let ratio = max / Math.max(width, height);
            width *= ratio;
            height *= ratio;
        }
        let c = document.createElement('canvas');
        c.width = width;
        c.height = height;
        this._log('exiting _makeSizedCanvas');
        return c;
    }

    _drawImage(c, img) {
        this._log('entering _drawImage');
        let ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 
            0, 0, img.width, img.height,
            0, 0, c.width, c.height);
        this._log('exiting _drawImage');
    }

    async processImage(f, options) {
        this._log('entering processImage');
        options = Object.assign(this.options, options);
        this._log(`processImage called with options: ${JSON.stringify(options)}`);
        try {
            f = await this._processImageInternal(
                f, options.maximumResolution, options.quality, options.forceJpeg);
            this._log('exiting processImage');
            return f;
        }
        catch(error) {
            this._log(`an error occurred processing image: ${error}`);
            this._log('exiting processImage');
            return f;
        }
    }

    async _copyExif(b_in, b_out) {
        this._log('entering _copyExif');
        let dv_in = new DataView(b_in);
        // ensure it's JPEG
        if (dv_in.getUint8(0) != 255 || dv_in.getUint8(1) != 216) {
            this._log('input image not a jpeg, exiting _copyExif');
            return b_out;
        }
        // find APP1 in old img
        let offset = 2;
        let app1;
        while (offset < b_in.byteLength) {
            let m1 = dv_in.getUint8(offset);
            let m2 = dv_in.getUint8(offset + 1);
            let size = dv_in.getUint16(offset + 2);
            if (m1==255 && m2==225) {
                app1 = b_in.slice(offset, offset + 2 + size);
                break;
            }
            offset += size + 2;
        }
        if (app1==null) {
            this._log('APP1 not found, exiting _copyExif');
            return b_out;
        }

        // insert APP1 after APP0 in new img
        offset = 2;
        let dv_out = new DataView(b_out);
        while (offset < b_out.byteLength) {
            let m1 = dv_out.getUint8(offset);
            let m2 = dv_out.getUint8(offset + 1);
            let size = dv_out.getUint16(offset + 2);
            if (m1==255 && m2==224) {
                this._log('inserting APP1 between APP0 and the rest of the image');
                let pre_app1 = b_out.slice(0, offset + 2 + size);
                let post_app1 = b_out.slice(offset + 2 + size);
                let blob = new Blob([pre_app1, app1, post_app1]);
                b_out = await this._blobToArrayBuffer(blob);
                break;
            }
            offset += size + 2;
        }

        this._log('exiting _copyExif');
        return b_out;
    }

    async _processImageInternal(f_in, max, quality, forceJpeg) {
        this._log('entering _processImageInternal');
        let buffer_in = await this._blobToArrayBuffer(f_in);
        let dataurl_in = await this._blobToDataUrl(f_in);
        let img = await this._dataUrlToImage(dataurl_in);
        let c = this._makeSizedCanvas(img.width, img.height, max);
        this._drawImage(c, img);
        let blob_out = await this._canvasToBlob(c, f_in.type, quality, forceJpeg);
        if (blob_out.type == 'image/jpeg') {
            let buffer_out = await this._blobToArrayBuffer(blob_out);
            buffer_out = await this._copyExif(buffer_in, buffer_out);
            blob_out = new Blob([buffer_out], {type: blob_out.type});
        }
        let f_out = new File([blob_out], (forceJpeg && !f_in.name.endsWith('.jpg')) ? f_in.name + '.jpg' : f_in.name, {type: blob_out.type});
        if (f_out.size < f_in.size) {
            this._log('processed image is smaller, exiting _processImageInternal');
            return f_out;
        }
        else {
            this._log('processed image is larger, exiting _processImageInternal');
            return f_in;
        }
    }

    _log(msg) {
        if (this.options.debug) {
            let ts = Date.now() / 1000;
            console.log(`${ts} - ${msg}`);
        }
    }
}

