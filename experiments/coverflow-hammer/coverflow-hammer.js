!function(w){
  var thumbnailElements = [];
  var spacingX; // the distance to space eachElement
  var dimX;     //the actual width of the elements, they're all treated as though they are this, even if it is not true, users should supply equally sized elements for best experience
  var dimY;     //height of the elements.
  var offset; //current position?
  var _root;
  var count; // number of elemnts to show
  var xform;
  var shift; // Distance away from centre to show non-centered element
  var dist; // how far back (z-axis) to move non-centred elements
  var angle;
  var target;
  var backgroundScale;
  var timeConstant;

  w.coverflowPreview = function coverflowPreview(rootElement, opts){
    _root = rootElement;
    _root.style.position='relative';
    for(var e of opts.thumbnails){
      thumbnailElements.push(e);
      e.style.position = 'absolute';
      rootElement.appendChild(e);
    }
    count = thumbnailElements.length;
    spacingX = 125;
    dimX = 175;
    dimY = 300;
    dist = -100;
    shift = spacingX/2;
    angle = -60;
    offset = target = 0;
    backgroundScale = 0.65;
    timeConstant = 250; //ms
    scroll(0);
    autoScroll();

    var mc = new Hammer.Manager(_root);
    mc.add(new Hammer.Pan({threshold: 0, pointers: 0}));
    mc.add(new Hammer.Swipe({direction:Hammer.DIRECTION_HORIZONTAL}).recognizeWith(mc.get('pan')))
    mc.on("panstart", onPanStart);
    mc.on("panmove", onPan);
    mc.on("panend swipe", onRelease);

    window.addEventListener("resize",onResize);
  };

  var panStartPos;
  function onPanStart(ev){
      panStartPos = offset;
      onPan(ev);
  }

  function onPan(ev){
    amplitude=0;
    if(panStartPos !== undefined && ev.deltaX){
      scroll(panStartPos-ev.deltaX); //when panning positively (thumb motion right), the images need to move right, which move the focus left.
    }
  }

  function onResize(ev){
    scroll(offset);
  }

  var beginAutoTime;
  var amplitude;
  var autoReqId;
  function onRelease(ev){
    target = offset;
    var velocity=  ev.velocityX * 100;
    if(velocity > 10 || velocity < -10){
      target = offset - 0.9 * velocity
    }
    var targetIndex = Math.round(target/spacingX);
    targetIndex = targetIndex < 0 ? 0 : targetIndex;
    targetIndex = targetIndex >= count ? count -1 : targetIndex;

    target = targetIndex * spacingX;
    amplitude = target-offset;
    beginAutoTime = Date.now();
    if(autoReqId){
      window.cancelAnimationFrame(autoReqId);
    }
    autoReqId = window.requestAnimationFrame(autoScroll);
  }

  function autoScroll(){
    autoReqId = undefined;
    var elapsed, delta;
    if(amplitude){
      elapsed = Date.now() - beginAutoTime;
      var adjust =  0.008; //adjust the exponential decay function by subtracting this from it so it reaches 0
                           //It is also then multiplied so that it still has a y-intercept of 1
      delta = amplitude *  (Math.exp( -elapsed / timeConstant) - adjust)/(1-adjust);
      if(delta * amplitude > 0) {
        scroll(target-delta);
        window.requestAnimationFrame(autoScroll);
      }else{
        scroll(target);
      }
    }
  }

  var rafRequestId;
  function scroll(x){
    //limits
    var maxOffset = spacingX * (count - 1) + spacingX/2 - 1;
    var minOffset = -spacingX/2 + 1;

    offset = (typeof x === 'number') ? x : offset; //move to x
    offset = offset > maxOffset ? maxOffset : offset;
    offset = offset < minOffset ? minOffset : offset;
    if(rafRequestId){
      window.cancelAnimationFrame(rafRequestId);
    }
    rafRequestId = window.requestAnimationFrame(animateScroll);
  }

  function animateScroll(){
    rafRequestId = undefined;
    var center = Math.floor((offset + spacingX / 2) / spacingX); //the image to show at the centre;
    var delta = offset - center * spacingX; //how close to the centred the cental element is
    var dir = (delta < 0) ? 1 : -1; //moving left or right? (left=positive)
    var tween = -dir * delta / spacingX; //proportion between properly centered and fully rotated to show central element

    //basic centering of everything
    var alignment = 'translateX(' + (parseInt(_root.clientWidth) - dimX) / 2 + 'px) ';
    alignment += 'translateY(' + (parseInt(_root.clientHeight) - dimY) / 2 + 'px)';

    //central element
    var el = thumbnailElements[center];
    el.style[xform] = alignment +
      ' translateX(' + (-delta / 2) + 'px)' + //account for off-centre
      ' translateX(' + (dir * shift * tween) + 'px)' + //partial shift from center
      ' translateZ(' + (dist * tween) + 'px)' + //partial going backwards
      ' rotateY(' + (dir * angle * tween) + 'deg)' + //partial rotation
      ' scale(' + (1 - (1-backgroundScale)*tween ) + ')';
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
        ;
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
        ' scale(' + (1 - (1-backgroundScale)*tween ) + ')';
    }
  }

  xform = 'transform';
  ['','webkit', 'Moz', 'O', 'ms'].every(function (prefix) {
    var e = prefix + 'Transform';
    if (typeof document.body.style[e] !== 'undefined') {
      xform = e;
      return false;
    }
    return true;
  });
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

  var el = document.getElementById("coverfluent");
  w.coverflowPreview(el,{
    thumbnails:g,
  });
}(window);
