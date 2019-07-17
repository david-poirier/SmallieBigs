function _readFileAsync(file) {
  return new Promise((resolve, reject) => {
    let reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result);
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  })
}

function _loadImage(img_b64, img_type) {
  return new Promise((resolve, reject) => {
    let img = document.createElement('img');
    img.onerror = reject;
    img.onload = () => {
      resolve(img);
    };
    img.src = 'data:' + img_type + ';base64,' + img_b64;
  });
}

function _canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.onerror = reject;
    canvas.toBlob(resolve, type, quality);
  });
}

function _arrayBufferToBase64(buffer) {
    var binary = '';
    var bytes = new Uint8Array(buffer);
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

async function _downloadFile(f) {
    var b = await _readFileAsync(f);
    var b64 = _arrayBufferToBase64(b);
    var url = 'data:' + f.type + ';base64,' + b64;
    var a = document.createElement('a');
    a.href = url;
    a.download = f.name;
    a.innerHTML = f.name;
    document.body.appendChild(a);
}

async function processImages(that) {
    for (var i=0; i<that.files.length; i++) {
	var f = that.files[i];
        console.log(`file in size: ${f.size}`);
        var fout = await processImage(f, 3000, 0.8);
        console.log(fout);
        console.log(`file out size: ${fout.size}`);
        await _downloadFile(fout);
    }
}

function _makeSizedCanvas(width, height, max) {
    if (Math.max(width, height) > max) {
        var ratio = max / Math.max(width, height);
        width *= ratio;
        height *= ratio;
    }
    var c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    return c;
}

function _drawImage(c, img) {
    var ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 
        0, 0, img.width, img.height,
        0, 0, c.width, c.height);
}

async function processImage(f, max, quality) {
    try {
        return _processImageInternal(f, max, quality);
    }
    catch(error) {
        console.log(`An error occurred processing image: ${error}`);
        return f;
    }
}

async function _copyExif(b_in, b_out) {
    var dv_in = new DataView(b_in);
    // ensure it's JPEG
    if (dv_in.getUint8(0) != 255 || dv_in.getUint8(1) != 216)
        return b_out;
    // find APP1 in old img
    var offset = 2;
    var app1;
    while (offset < b_in.byteLength) {
        var m1 = dv_in.getUint8(offset);
        var m2 = dv_in.getUint8(offset + 1);
        var size = dv_in.getUint16(offset + 2);
        if (m1==255 && m2==225) {
            app1 = b_in.slice(offset, offset + 2 + size);
            break;
        }
        offset += size + 2;
    }
    if (app1==null)
        return b_out;

    // insert APP1 after APP0 in new img
    offset = 2;
    var dv_out = new DataView(b_out);
    while (offset < b_out.byteLength) {
        var m1 = dv_out.getUint8(offset);
        var m2 = dv_out.getUint8(offset + 1);
        var size = dv_out.getUint16(offset + 2);
        if (m1==255 && m2==224) {
            pre_app1 = b_out.slice(0, offset + 2 + size);
            post_app1 = b_out.slice(offset + 2 + size);
            var blob = new Blob([pre_app1, app1, post_app1]);
            b_out = await _readFileAsync(blob);
            break;
        }
        offset += size + 2;
    }
    return b_out;
}

async function _processImageInternal(f_in, max, quality) {
    var buffer_in = await _readFileAsync(f_in);
    var buffer64_in = _arrayBufferToBase64(buffer_in);
    var img = await _loadImage(buffer64_in, f_in.type);
    var c = _makeSizedCanvas(img.width, img.height, max);
    _drawImage(c, img);
    var blob_out = await _canvasToBlob(c, f_in.type, quality);
    if (blob_out.type == 'image/jpeg') {
        var buffer_out = await _readFileAsync(blob_out);
        buffer_out = await _copyExif(buffer_in, buffer_out);
        blob_out = new Blob([buffer_out], {type: blob_out.type});
    }
    var f_out = new File([blob_out], f_in.name, {type: blob_out.type});
    if (f_out.size < f_in.size)
        return f_out;
    else
        return f_in;
}

