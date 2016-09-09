/*global PDFJS:false*/
/*eslint-env browser*/ 

var CSS_UNITS = 96.0 / 72.0; //this is apparently a thing.
var xform = 'transform';
['','webkit', 'Moz', 'O', 'ms'].every(function (prefix) {
    var e = prefix + (!!prefix ? 'T':'t') +  'ransform';
    if (typeof document.body.style[e] !== 'undefined') {
        xform = e;
        return false;
    }
    return true;
});

/*
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

    PDFJS.getDocument('1609.01714.pdf').then(function (pdf) {
        var pageDivs = [];
        function createPage(n) {
            if (n > pdf.numPages) {
                return;
            }
            var div = document.createElement('div');
            pageDivs.push(div);
            pdf.getPage(n).then(function (page) {
                var scale = 0.6;
                var viewport = page.getViewport(scale * CSS_UNITS);

                var canvas = document.createElement('canvas');
                var context = canvas.getContext('2d');

                var outputScale = getOutputScale(canvas);
                canvas.height = viewport.height * outputScale.sy;
                canvas.width = viewport.width * outputScale.sx;

                div.appendChild(canvas);
                page.render({
                    canvasContext: context,
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
*/

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
window.pdfViewer = function pdfViewer(container, documentUri) {
    // todo:
    /// <summary>Creates a pdf viewer in the given container</summary>
    /// <param name="container" type="HTMLElement">The container to create the pdf viewer in.</param>
    'use strict';

    if (container === null) {
        throw 'can not create viewer in null container';
    }
    if (container === undefined) {
        throw 'can not create viewer in undefined container';
    }
    if (!(container instanceof HTMLElement)) {
        throw 'can not create viewer in container that is not HTMLElement';
    }
    /** @type HTMLElement */
    var _container = container;

    /** @type String */
    var _uri = documentUri;
    /** @type HTMLElement */
    var _inner;
    /** @type PDFPromise<PDFDocumentProxy> */
    var _loadingTask;
    /** @type PDFDocumentProxy */
    var _pdfDocument;

    var _pages = [];
    /** @type {number} */
    var _pageCount;
    /** @type {number} */
    var _scale = defaultScale();
    /** @type {number} */
    var _position = 0;

    initialiseContainers();
    setPdf(_uri);

    var _viewer = {
        position: function (value) {
            if (value === undefined) {
                return _position;
            }
            setPosition(value);
        },
        scale: function (value) {
            if (value === undefined) {
                return _scale;
            }
            setScale(value);
        }
    };
    return _viewer;

    function setScale(value) {
        //todo: limit scaling.
        _scale = value;
        renderViewer();
    }

    function setPosition(value) {
        //todo limit positioning;
        _position = value;
        renderViewer();
    }

    function renderViewer() {
        //translate all of the containers to the correct position.
        //position 0 shows the first page.
        //Expect every page to have the same width.
        var width = _inner.firstChild.width;
        for (var i = 0; i < _pageCount; ++i){
            var translateText =
                'translate3d(' + (-_position + i * width) + ',0,0)';
            _inner.children[i].style[xform] = translateText;
        }
    }    

    /**
     * @param {String} uri
     */
    function setPdf(uri) {
        _loadingTask = PDFJS.getDocument(uri);
        _loadingTask.then(pdfReady);
    }
    /**
     * @param {PDFDocumentProxy} pdf
     */
    function pdfReady(pdf) {
        _pdfDocument = pdf;
        _pageCount = pdf.numPages;
        addPageContainers();
        _pdfDocument.getDownloadInfo().then(pdfLoaded);
    }
    /**
     * @param {PDFDocumentProxy} pdf
     */
    function pdfLoaded() {
        //create pageViewObjects
        for (var n = 1; n <= _pageCount; ++n){
            var pageView = {
                id: n,
                scale: _scale,
                rendered: false,
                loaded: false,
            };
            //todo: ? bind events
            _pages.push(pageView);
        }
        _pages.forEach(function (pageView) {
            var pagePromise = _pdfDocument.getPage(pageView.id);
            var index = pageView.id - 1;
            pagePromise.then(function (page) {
                _pages[index].page = page;
                _pages[index].loaded = true;
                redrawPage(_pages[index]);
            });
        });
    }

    function initialiseContainers() {
        _container.classList.add('pdfviewer-container');
        _inner = document.createElement('div');
        _inner.classList.add('pdfviewer-inner');
        _inner.classList.add('pdfviewer-loading');
        //todo: add mini previews?
    }

    function addPageContainers() {
        for (var i = 0; i < _pageCount; ++i){
            var pageContainer = document.createElement('div');
            pageContainer.classList.add('pdfviewer-pagecontainer');
            _inner.appendChild(pageContainer);
        }
    }

    function redrawPage(pageView) {
        var index = pageView.id - 1;
        var pageContainer = _inner.children[index];
        if (pageContainer === undefined) {
            throw 'can not redraw, not properly initialised';
        }
        var inView = pageInView(index);
        var rendered = pageView.rendered;
        var loaded = pageView.loaded;
        //draw page if it is in view and not currently rendered or has changed scale since last render.
        if (loaded && inView && (!rendered || _scale != pageView.scale)) {
            drawPage(pageView);
        }
        //clear a page which is not in view, but is currently rendered;
        if (!inView && rendered) {
            clearPage(pageView);
        }
    }

    function drawPage(pageView) {
        var index = pageView.id - 1;
        var pageContainer = _inner.children[index];
        while (pageContainer.firstChild) {
            pageContainer.removeChild(pageContainer.firstChild);
        }

        var canvas = document.createElement(canvas);
        var viewport = pageView.page.getViewport(_scale * CSS_UNITS);

        var outputScale = getOutputScale(canvas);
        canvas.height = viewport.height * outputScale.sy;
        canvas.width = viewport.width * outputScale.sx;

        var context = canvas.getContext('2d');
        pageContainer.classList.remove('pdfview-loading');
        pageContainer.appendChild(canvas);
        pageView.page.render({
            canvasContext: context,
            viewport: viewport
        });
        pageView.rendered = true;
    }

    function clearPage(pageView) {
        var index = pageView.id - 1;
        var pageContainer = _inner.children[index];
        while (pageContainer.firstChild) {
            pageContainer.removeChild(pageContainer.firstChild);
        }
        pageContainer.classList.add('pdfview-loading');
        pageView.rendered = false;
    }

    function pageInView(index) {
        //todo: implement properly based on scale/position/container size/page nearness.
        if (index > -27) {
            return true;
        }
        return true;
    }

    function defaultScale() {
        ///<summary>Determine a reasonable default scale based on device</summary>
        return 0.3;
    }
};