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
    /** @type {boolean} */
    var _ready = false;
    /** @type {number} */
    var _min_scale = 0.1;
    /** @type {number} */
    var _max_scale = 10;
    /** @type {number} */
    var _page_gap = 10; //pixel space between pages

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
        value = clampScale(value);
        var oldScale = _scale;
        _scale = value;
        var factor = _scale / oldScale;
        var viewerWidth = _container.clientWidth;
        var newPos = (_position + viewerWidth/2) * factor - viewerWidth/2;
        _pages.forEach(function (p) {
            redrawPage(p);
        });
        setPosition(newPos);
    }

    function clampScale(value) {
        if (value < _min_scale) {
            return _min_scale;
        }
        if (value > _max_scale) {
            return _max_scale;
        }
        return value;
    }

    function setPosition(value) {
        value = clampPosition(value);
        _position = value;
        renderViewer();
    }

    function clampPosition(value) {
        var pageWidth = _pages[0].baseWidth * _scale * getOutputScale().sx;
        var viewerWidth = _container.clientWidth;
        if (value < -0.5 * viewerWidth) {
            return -0.5 * viewerWidth;
        }
        if (value > _pageCount * (pageWidth + _page_gap) - viewerWidth / 2) {
            return _pageCount * (pageWidth + _page_gap) - viewerWidth / 2;
        }
        return value;
    }

    function renderViewer() {
        //translate all of the containers to the correct position.
        //position 0 shows the first page.
        //Expect every page to have the same width.
        var width = _pages[0].baseWidth * _scale * getOutputScale().sx;
        _pages.forEach(function (p) {
            redrawPage(p);
            var i = p.id - 1;
            var translateText =
                'translate3d(' + (-_position + i * (width + _page_gap)) + 'px,0px,0px)';
            _inner.children[i].style[xform] = translateText;
            _inner.children[i].style.visibility = pageInView(i) ? 'visible' : 'hidden';
        });
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
        for (var n = 1; n <= _pageCount; ++n) {
            var pageView = {
                id: n,
                scale: _scale,
                rendered: false,
                loaded: false,
            };
            //todo: ? bind events
            _pages.push(pageView);
        }
        var pagePromises = [];
        _pages.forEach(function (pageView) {
            var pagePromise = _pdfDocument.getPage(pageView.id);
            pagePromises.push(pagePromise);
            var index = pageView.id - 1;
            /** @param {} page */
            pagePromise.then(function (page) {
                _pages[index].baseWidth = page.getViewport(1.0*CSS_UNITS).width;
                _pages[index].page = page;
                _pages[index].loaded = true;
            });
        });
        Promise.all(pagePromises).then(function () {
            _ready = true;
            renderViewer();
        });
    }

    function initialiseContainers() {
        _container.classList.add('pdfviewer-container');
        _inner = document.createElement('div');
        _inner.classList.add('pdfviewer-inner');
        _container.appendChild(_inner);
        //todo: add mini previews?
    }

    function addPageContainers() {
        for (var i = 0; i < _pageCount; ++i){
            var pageContainer = document.createElement('div');
            pageContainer.classList.add('pdfviewer-pagecontainer');
            pageContainer.style.visibility = 'hidden';
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

        var canvas = document.createElement('canvas');
        var viewport = pageView.page.getViewport(_scale * CSS_UNITS);

        var outputScale = getOutputScale(canvas);
        canvas.height = viewport.height * outputScale.sy;
        canvas.width = viewport.width * outputScale.sx;

        var context = canvas.getContext('2d');
        pageView.rendered = true;
        pageView.page.render({
            canvasContext: context,
            viewport: viewport
        }).then(function () {
            pageContainer.classList.remove('pdfview-loading');
            pageContainer.appendChild(canvas);
        });
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
        var pageWidth = _pages[0].baseWidth * _scale * getOutputScale().sx;
        var viewerWidth = _container.clientWidth;
        var minIndex = Math.floor(_position / (pageWidth + _page_gap)) - 1; //-1 to allow an extra page to be prerendered
        var maxIndex = Math.floor((_position + viewerWidth) / (pageWidth + _page_gap)) + 1; //same for the + 1

        return index >= minIndex && index <= maxIndex;
    }

    function defaultScale() {
        ///<summary>Determine a reasonable default scale based on device</summary>
        return 0.6;
    }
    /**
     * @param {EventTarget} el
     */
    function registerTouchEvents(el) {
        el.addEventListener('touchStart', touchStart);
        el.addEventListener('touchEnd', touchEnd);
        el.addEventListener('touchCancel', touchCancel);
        el.addEventListener('touchMove', touchMove);
    }

    /* touch controls */
    function touchStart(ev) {
        
    }

    function touchEnd(ev) {

    }

    function touchMove(ev) {
        
    }    

    function touchCancel(ev) {
        
    }
};