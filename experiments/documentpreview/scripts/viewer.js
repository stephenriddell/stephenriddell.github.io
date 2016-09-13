/*global PDFJS:false*/
/*eslint-env browser*/
/*eslint-env es6*/
!function PDFViewClosure() {
    'use strict';
    var CSS_UNITS = 96.0 / 72.0; //this is apparently a thing.
    var xform = 'transform';
    ['', 'webkit', 'Moz', 'O', 'ms'].every(function (prefix) {
        var e = prefix + (prefix ? 'T' : 't') + 'ransform';
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
    !function () {
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
                return createPage(2);
            }).then(function () {
                pageDivs.forEach(function (div) {
                    document.body.appendChild(div);
                });
            });
        });
    } ();

    window.PdfView = function PdfView(container, pdfLocation) {
        var pdfViewModel = {
            pages: [],
            scale: scale,
            position: position,
            container: container,
        };
        var _scale = 0;
        var _position = { x: 0, y: 0 };

        container.style.postion = 'relative';
        PDFJS.getDocument(pdfLocation).then(function (pdf) {
            var finalPageInitialisedResolve;
            var promise = new Promise(function (resolve) {
                finalPageInitialisedResolve = resolve;
            });
            var totalWidth = 0;
            function initPage(pageNum) {
                if (pageNum === pdf.numPages){
                    finalPageInitialisedResolve();
                    return;
                }
                pdf.getPage(pageNum).then(function (page) { 
                    var pageView = PdfPageView(page);
                    pageView.baseTotalPrevPagesWidth = totalWidth;
                    totalWidth += pageView.baseSize.w;
                    pdfViewModel.pages.push(pageView);
                });
            }
            initPage(0);
        });

        function scale(value) {
            if (value) {
                _scale = value;
                return;    
            }
            return _scale;
        }
        function position(value) {
            if (value) {
                if (value.x) {
                    _position.x = value.x;
                }
                if (value.y) {
                    _position.y = value.y;
                }
            }
            return {
                x: _position.x,
                y: _position.y
            };
        }

        return pdfViewModel;
    };

    function PdfPageView(pdfPage) {
        var CLASS_LOADING = 'pdfview-loading';
        var CLASS_DIV = 'pdfview-pageContainer';
        var RENDER_INIT = 'inital';
        var RENDER_RUNNING = 'running';
        var RENDER_COMPLETE = 'complete';
        var RENDER_PAUSED = 'paused';
        var _scale = 0;
        var pageView = {
            pdfPage: pdfPage, //the PdfPageProxy object
            baseSize: { w: 0, h: 0 }, //the unscaled natural css size for the canvas
            size: { w: 0, h: 0 }, //the current space that this wants to take up
            scale: function (value) {
                if (value) {
                    _scale = value;
                    return;
                }
                return _scale;
            }, //the current scale to draw at. can be different to previous render.
            baseTotalPrevPagesWidth: 0, //total width of pages before this one. used in conjunction with scaling to position page.
            pageNo: 0, //the 0-indexed page number.
            renderStatus: RENDER_INIT,
            renderScale: 0, //the previous scale * outputscale this page was rendered at.
            renderTask: null, //the current rendertask for this page.
            canvas: null,
            context: null,
            div: null,
            onMove: onMove,
            inView: false,
        };

        function onMove(inView) {
            if (inView === pageView.inView) {
                //page hasn't moved in or out of view, but might have rescaled enough to redraw.
                if (!pageView.renderScale) {
                    return;
                }
                if (!pageView.scale()) {
                    return;
                }
                if (!pageView.context) {
                    return;
                }
                var newScale = pageView.scale() * getOutputScale(pageView.context);
                if (newScale / pageView.renderScale > 1.3 || pageView.renderScale / newScale > 1.3) {
                    render();
                }
            }
            //has changed visibility;
            pageView.inView = inView;
            if (pageView.inView) {
                render();
            } else {
                reset();
            }
        }

        function initialise() {
            var vp = pdfPage.getViewport(1);
            pageView.baseSize.w = vp.width;
            pageView.baseSize.h = vp.height;
            pageView.div = document.createElement('div');
            pageView.div.classList.add(CLASS_DIV);
        }

        function render() {
            reset();
            pageView.renderStatus = RENDER_RUNNING;
            var scale = pageView.scale;
            var page = pageView.pdfPage;
            var viewport = page.getViewport(scale * CSS_UNITS);

            var canvas = document.createElement('canvas');
            pageView.canvas = canvas;
            var context = canvas.getContext('2d');
            pageView.context = context;

            var outputScale = getOutputScale(context);
            if (PDFJS.maxCanvasPixels > 0) {
                var pixelsInViewport = viewport.width * viewport.height;
                var maxScale = Math.sqrt(PDFJS.maxCanvasPixels / pixelsInViewport);
                if (outputScale.sx > maxScale || outputScale.sy > maxScale) {
                    outputScale.sx = maxScale;
                    outputScale.sy = maxScale;
                    outputScale.scaled = true;
                    var hasRestrictedScaling = true;//TODO: use this to css element to be larger
                } else {
                    hasRestrictedScaling = false;
                }
            }

            pageView.renderScale = scale * outputScale.sx;
            canvas.height = viewport.height * outputScale.sy;
            canvas.width = viewport.width * outputScale.sx;
            canvas.style.height = viewport.height + 'px';
            canvas.style.width = viewport.width + 'px';
            pageView.size.h = viewport.height;
            pageView.size.w = viewport.width;
            canvas.setAttribute('hidden', 'hidden');

            var transform = !outputScale.scaled ? null :
                [outputScale.sx, 0, 0, outputScale.sy, 0, 0];
            var renderTask = page.render({
                canvasContext: context,
                transform: transform,
                viewport: viewport
            });
            pageView.renderTask = renderTask;
            var resolveRenderPromise, rejectRenderPromise;
            var promise = new Promise(function (resolve, reject) {
                resolveRenderPromise = resolve;
                rejectRenderPromise = reject;
            });

            function renderComplete(error) {
                if (pageView.renderTask === renderTask) {
                    pageView.renderTask = null;
                }
                if (error === 'cancelled') {
                    rejectRenderPromise(error);
                    return;
                }
                pageView.renderStatus = RENDER_COMPLETE;
                pageView.canvas.removeAttribute('hidden');
                pageView.div.classList.remove(CLASS_LOADING);
                resolveRenderPromise();
            }

            renderTask.promise.then(function () {
                renderComplete(null);
            }, function (error) {
                renderComplete(error);
            });
            
            return promise;
        }

        function reset() {
            if (pageView.renderTask && (
                pageView.renderStatus === RENDER_RUNNING
                || pageView.renderStatus === RENDER_INIT
                || pageView.renderStatus === RENDER_PAUSED)
            ) {
                pageView.renderTask.cancel();
            }
            pageView.renderStatus = RENDER_INIT;
        
            if (pageView.div && pageView.canvas) {
                pageView.div.removeChild(pageView.canvas);
                pageView.div.classList.add(CLASS_LOADING);
                delete pageView.canvas;
            }
        }

        initialise();        
        return pageView;
    }


    var zoomResizeTimeout;
    /**
     * Sets up a source of resize events for when a mobile browser
     */
    function ZoomResizeEventSource() {
        if (zoomResizeTimeout) {
            return;
        }
        var scale = (document.documentElement.clientWidth / window.innerWidth) || 1;
        if (scale < 1) {
            scale = 1;
        }
        var started = false;
        function zoomResizeEventTick() {
            if (started) {
                return;
            }
            started = true;
            var newScale = (document.documentElement.clientWidth / window.innerWidth) || 1;
            if (newScale < 1) {
                newScale = 1;
            }
            if (Math.abs(scale - newScale) > 0.02) {
                var event = document.createEvent('Event');
                event.initEvent('resize', true, true);
                window.dispatchEvent(event);
            }
            scale = newScale;
            zoomResizeTimeout = window.setTimeout(150, zoomResizeEventTick); //150 ms period. Might feel a little sluggish, but prevents 
        }
        return {
            start: zoomResizeEventTick,
            stop: function () {
                if (zoomResizeTimeout) {
                    window.clearTimeout(zoomResizeTimeout);
                }
                zoomResizeTimeout = undefined;
                started = false;
            }
        };
    }
} ();