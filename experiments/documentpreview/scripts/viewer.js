!function (w) {
    PDFJS.getDocument("1609.01714.pdf").then(function (pdf) {
        var pageDivs = [];
        function createPage(n) {
            if (n > pdf.numPages) {
                return;
            }
            var div = document.createElement("div");
            pageDivs.push(div);
            var canvas = document.createElement("canvas");
            div.appendChild(canvas);
            var context = canvas.getContext("2d");
            canvas.width = 500;
            canvas.height = Math.round(Math.sqrt(2) * 500);
            pdf.getPage(n).then(function (page) {
                var viewport = page.getViewport(1);
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