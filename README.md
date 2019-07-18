# SmallieBigs
## Pre-process images in the browser to reduce file size before upload
Control maximum resolution and compression quality using the max and quality options.

### Usage
```javascript
let sb = new SmallieBigs({debug: true});
let smallImageFile = await sb.processImage(largeImageFile, {maximumResolution: 3000, quality: 0.8});
```

