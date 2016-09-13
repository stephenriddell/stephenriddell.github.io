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


function getOutputScale(ctx) {
    var canvas;
    if (ctx === undefined) {
        if (canvas === undefined) {
            canvas = document.createElement('canvas');
        }
        ctx = canvas.getContext('2d');
    }
    var devicePixelRatio = window.devicePixelRatio || 1;
    var backingStoreRatio = ctx.webkitBackingStorePixelRatio ||
                            ctx.mozBackingStorePixelRatio ||
                            ctx.msBackingStorePixelRatio ||
                            ctx.oBackingStorePixelRatio ||
                            ctx.backingStorePixelRatio || 1;
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
            pdf.getPage(n).then(function (page) {
                var scale = 1;
                var viewport = page.getViewport(scale * CSS_UNITS);

                var canvas = document.createElement('canvas');
                var context = canvas.getContext('2d');

                var outputScale = getOutputScale(canvas);
                canvas.height = viewport.height * outputScale.sy;
                canvas.width = viewport.width * outputScale.sx;

                div.appendChild(canvas);
                var transform = !outputScale.scaled ? null :
                    [outputScale.sx, 0, 0, outputScale.sy, 0, 0];
                page.render({
                    canvasContext: context,
                    transform: transform,
                    viewport: viewport
                });
            });
            createPage(n + 1);
        }
        createPage(1);
        pageDivs.forEach(function (div) {
            document.body.appendChild(div);
        });
    });
} (window);