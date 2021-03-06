function defValue(provided, def){
  'use strict';
  return provided !== undefined ? provided : def;
}

!function(w){
  'use strict';

  function rollingAverage(oldAverage,newValue){
    return 0.9 * newValue + 0.1*oldAverage;
  }

  var kineticDefaults = {
    offset: 0,
    snapFn: function(x){return x;},
    restrictFn: function(x){return x;},
    autoScrollThreshold : 10,
    easingFn:function(t){
      var a = 0.008;
      var ease = 1-(Math.exp(-t / 225) -a)/(1-a);
      if(ease > 1){
        ease = 1;
      }
      return ease;
    },
    moveFn(t,d){
      return t + d;
    }
  }

  w.kinetic = function kinetic(opts) {
    var offset = defValue(opts.offset, 0);
    var velocity = 0; //currently tracked control velocity
    var timestamp = Date.now(); //most recent tracked time
    var target; //target positon to move to automatically
    var amplitude; //total amount of movement in current automatic movement
    var snapFn = //function to snap to items. Identity function for no snap.
      defValue(opts.snapFn, kineticDefaults.snapFn);
    var restrictFn =  //function to restrict range of values
                      //(typically clamping or identity function - cylcical behaviour should be implemented by the renderer)
      defValue(opts.restrictFn,kineticDefaults.restrictFn);
    var easingFn = //easing function  for automated scrolling default exponential decay
      defValue(opts.easingFn,kineticDefaults.easingFn);
    var listeners =
      defValue(opts.listeners, []);
    var autoScrollThreshold = 
      defValue(opts.autoScrollThreshold, kineticDefaults.autoScrollThreshold);
    var moveFn =
      defValue(opts.moveFn, kineticDefaults.moveFn);


    var autoScrollFn; 
    autoScrollFn = function() {
      if(amplitude !== 0){ // amplitude === 0 implies no autoscrolling
        var now = Date.now();
        var timeDelta = now - timestamp;
        var delta = amplitude * ( 1 - easingFn(timeDelta));
        offset = target-delta
        listeners.forEach(function(l){
          l(offset);
        });
        if(delta != 0){
          window.requestAnimationFrame(autoScrollFn)
        }
      }
    }

    var lastTrackedOffset = offset;
    var prevVelocity = 0;
    var velocity = 0;
    var tracking = false;
    var trackTicker;
    var trackVelocity = function(){
      var now = Date.now();
      var timeDelta = now - timestamp;
      timestamp = now;
      var posDelta = offset - lastTrackedOffset;
      lastTrackedOffset = offset;

      var v = posDelta/(timeDelta+1) * 1000; //units/second
      velocity = rollingAverage(velocity,v);
      if(velocity > 10000) { velocity = 10000; }
      if(velocity < -10000) { velocity = - 10000; }
      if(!tracking){
        w.clearInterval(trackTicker);
      }
    }

    function moveBy (x){
      amplitude = 0; // manual movement - no auto movement
      var prevOffset = offset;
      offset = restrictFn(moveFn(offset, x));
      if(!tracking){
        tracking = true;
        velocity = 0;
        timestamp = Date.now();
        trackTicker = w.setInterval(trackVelocity,20);
      }
      listeners.forEach(function(l){
        l(offset);
      });
    }

    function release() {
      tracking = false;
      var now = Date.now();
      target = offset;
      if(velocity > autoScrollThreshold || velocity < -autoScrollThreshold){
        amplitude = 0.5 * velocity;
        target = target + amplitude; 
      }
      target = snapFn(restrictFn(target));
      amplitude = target - offset;
      timestamp = now;
      window.requestAnimationFrame(autoScrollFn);
    }

    function stop() {
        if(trackTicker){
          w.clearInterval(trackTicker);
        }
        velocity = 0;
        release();
    }

    function offsetFn() {
      return offset;
    }

    return {
      moveBy : moveBy,
      release : release,
      stop : stop,
      offset : offsetFn
    }
  };
}(window);
!function(w){
  var xform = 'transform';
    ['','webkit', 'Moz', 'O', 'ms'].every(function (prefix) {
      var e = prefix + 'Transform';
      if (typeof document.body.style[e] !== 'undefined') {
        xform = e;
        return false;
      }
      return true;
    });
  w.coverflowPreview = function coverflowPreview(rootElement, opts){
    var _root = rootElement;
    _root.style.position='relative';
    var thumbnailElements = [];
    opts.thumbnails.forEach(function(e){
      thumbnailElements.push(e);
      e.style.position = 'absolute';
      rootElement.appendChild(e);
    });
    var count = thumbnailElements.length;
    var spacingX = defValue(opts.spacingX,125);
    var dimX = defValue(opts.dimX,175);
    var dimY = defValue(opts.dimY,300);
    var dist = defValue(opts.dist,-100);
    var shift = defValue(opts.shift,spacingX/2);
    var angle = defValue(opts.angle,-60);
    var backgroundScale = defValue(opts.backgroundScale, 0.65);

    var mc = new Hammer.Manager(_root,{touchAction:'pan-y'});
    mc.add(new Hammer.Pan({threshold: 0, pointers: 0, direction: Hammer.DIRECTION_HORIZONTAL}));
    mc.add(new Hammer.Pinch().recognizeWith(mc.get("pan")));
    mc.on("panstart panmove", onPan);
    mc.on("panend", onRelease);
    mc.on("pinchstart", onPinchStart);
    mc.on("pinchend", onPinchEnd);
    mc.on("pinch", onPinch);
    window.addEventListener("resize",onResize);

    var coverFlowKinetic = w.kinetic({
      listeners: [posChanged],
      restrictFn: function(x){
        if(x <= -0.5 * spacingX){
          return -0.5 * spacingX + 1;
        }
        if(x>= spacingX * (count - 0.5)){
          return spacingX * (count -0.5) - 1;
        }
        return x;
      },
      snapFn: function(x){
        return Math.round(x/spacingX)*spacingX;
      }
    });

    var scaleKinetic = w.kinetic({
      listeners: [scaleChanged],
      restrictFn: function(x){
        if( x < 1 ) { return 1; }
        if( x > 2) { return 2; }
        return x;
      },
      snapFn: function(x){
        return Math.round(x);
      },
      moveFn: function(t,d){
        return t * d;
      },
      offset: 1,
    })
    var scale = 1;

    posChanged(coverFlowKinetic.offset());

    var prevPanDelta = 0;
    function onPan(ev){
      if(!pinching){
        coverFlowKinetic.moveBy(-(ev.deltaX - prevPanDelta));
        prevPanDelta = ev.deltaX;
      }
    }

    function onResize(ev){
      render();
    }

    function onRelease(ev){
      prevPanDelta = 0;
      coverFlowKinetic.release();
    }

    var pinching = false;
    var lastScale;
    function onPinchStart(){
      lastScale = 1;
      pinching = true;
      coverFlowKinetic.stop();
    }
    function onPinch(ev){
      scaleKinetic.moveBy(ev.scale/lastScale);
      lastScale = ev.scale;
    }
    function onPinchEnd(){
      pinching = false;
      scaleKinetic.release();
    }

    var offset;
    function posChanged(pos){
      offset = pos;
      render();
    }

    function scaleChanged(s){
      scale = s;
      render();
    }


    function render(){
      var center = Math.floor((offset + spacingX / 2) / spacingX); //the image to show at the centre;
      var delta = offset - center * spacingX; //how close to the centred the cental element is
      var dir = (delta < 0) ? 1 : -1; //moving left or right? (left=positive)
      var tween = -dir * delta / spacingX; //proportion between properly centered and fully rotated to show central element

      //basic centering of everything
      var alignment = 'translateX(' + (parseInt(_root.clientWidth) - dimX) / 2 + 'px) ';
      alignment += 'translateY(' + (parseInt(_root.clientHeight) - dimY) / 2 + 'px)';

      //central element
      var el = thumbnailElements[center];
        var transformText = alignment +
        ' translateX(' + (-delta / 2) + 'px)' + //account for off-centre
        ' translateX(' + (dir * shift * tween) + 'px)' + //partial shift from center
        ' translateZ(' + (dist * tween) + 'px)' + //partial going backwards
        ' rotateY(' + (dir * angle * tween) + 'deg)' + //partial rotation
        ' scale(' + (1 - (1-backgroundScale)*tween ) * (1 + ((1-tween) * (scale - 1))) + ')';
      el.style[xform] = transformText;

      el.style.zIndex = 0; //set in front of others
      el.style.opacity = 1; // set fully visible

      //other elements
      //left
      var i = 1;
      while(center - i >= 0){
        el = thumbnailElements[center - i];
        el.style[xform] = alignment +
          ' translateX(' + (-shift + (-spacingX * i - delta) / 2) + 'px)' +
          ' translateZ(' + dist + 'px)' +
          ' rotateY(' + -angle + 'deg)' + 
          ' scale(' + backgroundScale + ')';
        el.style.zIndex = -i;
        el.style.opacity = 1;

        i++;
      }
      //right
      i = 1;
      while(center + i < count){
        el = thumbnailElements[center + i];
        el.style[xform] = alignment +
          ' translateX(' + (shift + (spacingX * i - delta) / 2) + 'px)' +
          ' translateZ(' + dist + 'px)' +
          ' rotateY(' + angle + 'deg)' +
          ' scale(' + backgroundScale + ')';
        el.style.zIndex = -i;
        i++;
      }
      //redo the slightly off center element, to tween like the centre element
      if(center-dir >= 0 && center-dir < count){
        el = thumbnailElements[center-dir];
        tween = 1 - tween;
        delta = delta + dir * spacingX;
        dir = dir * -1;
        el.style[xform] = alignment +
          ' translateX(' + (-delta / 2) + 'px)' + //account for off-centre
          ' translateX(' + (dir * shift * tween) + 'px)' + //partial shift from center
          ' translateZ(' + (dist * tween) + 'px)' + //partial going backwards
          ' rotateY(' + (dir * angle * tween) + 'deg)' + //partial rotation
          ' scale(' + (1 - (1-backgroundScale)*tween ) * (1 + ((1-tween) * (scale - 1))) + ')';
      }
    }

  };

}(window);

!function(w){
  var g = []; 
  var n = 15;
  for(i=0;i<n;++i){
    var grey = parseInt(i*255/n);
    var e = document.createElement("img");
    e.style.height='300px';
    e.style.width='175px';
    e.style.backgroundColor = `rgba(${grey},${grey},${grey},1)`;
    e.style.border = '1px solid limegreen';
    g.push(e);
  }

  var el = document.getElementById("cf1");
  w.coverflowPreview(el,{
    thumbnails:g,
  });

  g=[];
  for(i=0;i<n;++i){
    var grey = parseInt(i*255/n);
    var e = document.createElement("img");
    e.style.height='300px';
    e.style.width='175px';
    e.style.backgroundColor = `rgba(${255-grey},${255-grey},${255-grey},1)`;
    e.style.border = '1px solid limegreen';
    g.push(e);
  }

  el = document.getElementById("cf2");
  w.coverflowPreview(el,{
    thumbnails:g,
  });
}(window);
