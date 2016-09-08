!function (w) {
    function getOutputScale(ctx) {
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
    var CSS_UNITS = 96.0 / 72.0; //this is apparently a thing.

    PDFJS.getDocument("1609.01714.pdf").then(function (pdf) {
        var pageDivs = [];
        function createPage(n) {
            if (n > pdf.numPages) {
                return;
            }
            var div = document.createElement("div");
            pageDivs.push(div);
            pdf.getPage(n).then(function (page) {
                console.log(page.width);
                console.log(page.height);

                var context = canvas.getContext("2d");
                var scale = 1;
                var viewport = page.getViewport(scale * CSS_UNITS);

                var canvas = document.createElement("canvas");
                var outputScale = getOutputScale(canvas);
                canvas.height = viewport.height * outputScale.sy;
                canvas.width = viewport.width * outputScale.sx;

                div.appendChild(canvas);
                page.render({
                    canvasContext: context,
                    viewport: viewport
                });
            })
            createPage(n + 1);
        }
        createPage(1);
        pageDivs.forEach(function (div) {
            document.body.appendChild(div);
        });
    });
} (window);