!function(w){
  let thumbnailElements = [];
  let dimX; // horizontal space taken by each element?
  let dimY;
  let offset; //current position?
  let _root;
  let count; // number of elemnts to show
  let xform;
  let shift; // Distance away from centre to show non-centered element
  let dist; // how far back (z-axis) to move non-centred elements
  let angle;
  let target;
  let backgroundScale;
  let timeConstant;

  w.coverflowPreview = function coverflowPreview(rootElement, opts){
    _root = rootElement;
    _root.style.position='relative';
    for(let e of opts.thumbnails){
      thumbnailElements.push(e);
      e.style.position = 'absolute';
      rootElement.appendChild(e);
    }
    count = thumbnailElements.length;
    dimX = 125;
    dimY = 300;
    dist = -100;
    shift = dimX/2;
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

  let panStartPos;
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

  let beginAutoTime;
  let amplitude;
  let autoReqId;
  function onRelease(ev){
    target = offset;
    let velocity=  ev.velocityX * 100;
    if(velocity > 10 || velocity < -10){
      target = offset - 0.9 * velocity
    }
    let targetIndex = Math.round(target/dimX);
    targetIndex = targetIndex < 0 ? 0 : targetIndex;
    targetIndex = targetIndex >= count ? count -1 : targetIndex;

    target = targetIndex * dimX;
    amplitude = target-offset;
    beginAutoTime = Date.now();
    if(autoReqId){
      window.cancelAnimationFrame(autoReqId);
    }
    autoReqId = window.requestAnimationFrame(autoScroll);
  }

  function autoScroll(){
    autoReqId = undefined;
    let elapsed, delta;
    if(amplitude){
      elapsed = Date.now() - beginAutoTime;
      delta = amplitude *  Math.exp( -elapsed / timeConstant);
      if(delta > 4 || delta < -4){
        scroll(target-delta);
        window.requestAnimationFrame(autoScroll);
      }else{
        scroll(target);
      }
    }
  }

  let rafRequestId;
  function scroll(x){
    //limits
    let maxOffset = dimX * (count - 1) + dimX/2 - 1;
    let minOffset = -dimX/2 + 1;

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
    let center = Math.floor((offset + dimX / 2) / dimX); //the image to show at the centre;
    let delta = offset - center * dimX; //how close to the centred the cental element is
    let dir = (delta < 0) ? 1 : -1; //moving left or right? (left=positive)
    let tween = -dir * delta / dimX; //proportion between properly centered and fully rotated to show central element

    //basic centering of everything
    var alignment = 'translateX(' + (parseInt(_root.clientWidth) - dimX) / 2 + 'px) ';
    alignment += 'translateY(' + (parseInt(_root.clientHeight) - dimY) / 2 + 'px)';

    //central element
    let el = thumbnailElements[center];
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
    let i = 1;
    while(center - i >= 0){
      el = thumbnailElements[center - i];
      el.style[xform] = alignment +
        ' translateX(' + (-shift + (-dimX * i - delta) / 2) + 'px)' +
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
        ' translateX(' + (shift + (dimX * i - delta) / 2) + 'px)' +
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
      delta = delta + dir * dimX;
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
  function* previewGenerator(n){
    for(i=0;i<n;++i){
      var grey = parseInt(i*255/n);
      var e = document.createElement("img");
      e.style.height='300px';
      e.style.width='175px';
      e.style.backgroundColor = `rgba(${grey},${grey},${grey},1)`;
      e.style.border = '1px solid limegreen';
      yield e;
    }
  }

  let g = previewGenerator(12); 
  let e = document.getElementById("coverfluent");
  w.coverflowPreview(e,{
    thumbnails:g,
  });
}(window);
