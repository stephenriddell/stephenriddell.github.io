/*global PDFJS:false*/
/*eslint-env browser*/
/*eslint-env es6*/

var CSS_UNITS = 96.0 / 72.0; //this is apparently a thing.
var xform = 'transform';
['','webkit', 'Moz', 'O', 'ms'].every(function (prefix) {
    var e = prefix + (prefix ? 'T':'t') +  'ransform';
    if (typeof document.body.style[e] !== 'undefined') {
        xform = e;
        return false;
    }
    return true;
});

function getPixelRatio() {
    //On mobile devices this is the ratio css pixel height / device pixel height, whilst at 1.0 scale
    //On desktop devices this is typically the current scale.
    var dpr = window.devicePixelRatio || 1;
    //On mobile devices this adequately measures scale on a page using viewport width=device-width.
    //On desktop devices it is 1 (or slightly less to compensate for a scroll bar.)
    var scale = (document.documentElement.clientWidth / window.innerWidth) || 1;
    scale = scale < 1 ? 1 : scale;
    return dpr * scale;
}

function getOutputScale(ctx) {
    var canvas;
    if (ctx === undefined) {
        if (canvas === undefined) {
            canvas = document.createElement('canvas');
        }
        ctx = canvas.getContext('2d');
    }
    var devicePixelRatio = getPixelRatio();
    var backingStoreRatio = ctx.webkitBackingStorePixelRatio ||
                            ctx.mozBackingStorePixelRatio ||
                            ctx.msBackingStorePixelRatio ||
                            ctx.oBackingStorePixelRatio ||
                            ctx.backingStorePixelRatio || 1; //backing store ratio is deprecated and will likely always be 1.
    var pixelRatio = devicePixelRatio / backingStoreRatio;
    return {
        sx: pixelRatio,
        sy: pixelRatio,
        scaled: pixelRatio !== 1
    };
}
!function (w) {
    PDFJS.getDocument('1609.01714.pdf').then(function (pdf) {
        var pageDivs = [];
        function createPage(n) {
            if (n > pdf.numPages) {
                return;
            }
            var div = document.createElement('div');
            pageDivs.push(div);
            var promise = new Promise(function (resolve, reject) {
                
                pdf.getPage(n).then(function (page) {
                    var scale = 1;
                    var viewport = page.getViewport(scale * CSS_UNITS);

                    var canvas = document.createElement('canvas');
                    var context = canvas.getContext('2d');

                    var outputScale = getOutputScale(canvas);
                    if (PDFJS.maxCanvasPixels > 0) {
                        var pixelsInViewport = viewport.width * viewport.height;
                        var maxScale = Math.sqrt(PDFJS.maxCanvasPixels / pixelsInViewport);
                        if (outputScale.sx > maxScale || outputScale.sy > maxScale) {
                            outputScale.sx = maxScale;
                            outputScale.sy = maxScale;
                            outputScale.scaled = true;
                            var hasRestrictedScaling = true;//TODO: use this to css transform element larger.
                        } else {
                            hasRestrictedScaling = false;
                        }
                    }
                
                    canvas.height = viewport.height * outputScale.sy;
                    canvas.width = viewport.width * outputScale.sx;
                    canvas.style.height = viewport.height;
                    canvas.style.width = viewport.width;

                    div.appendChild(canvas);
                    var transform = !outputScale.scaled ? null :
                        [outputScale.sx, 0, 0, outputScale.sy, 0, 0];
                    page.render({
                        canvasContext: context,
                        transform: transform,
                        viewport: viewport
                    }).then(resolve(), reject());
                });
            });
            return promise;
        }
        createPage(1).then(function () {
            createPage(2);
        });    
        pageDivs.forEach(function (div) {
            document.body.appendChild(div);
        });
    });
} (window);