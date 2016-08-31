!function(w){
  let thumbnailElements = [];
  let dimX; // horizontal space taken by each element?
  let dimY;
  let offset; //current position?
  let _root;
  let count; // number of elemnts to show
  let xform;
  let shift; // unsure? used to subtly impact positioning - movement away from center?
  let dist; // how far back (z-axis) to move non-centred elements
  let angle;
  let target;

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
    dimY = 200;
    dist = -200;
    shift = 20;
    angle = -60;
    offset = target = 0;
    scroll(375);

    var mc = new Hammer.Manager(_root);
    mc.add(new Hammer.Pan({threshold: 0, pointers: 0}));
    mc.add(new Hammer.Swipe({direction:Hammer.DIRECTION_HORIZONTAL}).recognizeWith(mc.get('pan')))
      mc.on("panstart panmove", pantry);
    mc.on("swipe", swipetry);
    console.log("things on");
  };

  function pantry(ev){
    console.log("pan:");
    console.log(ev);
  }

  function swipetry(ev){
    console.log("swipe");
    console.log(ev);
  }

  function scroll(x){
    //limits
    let maxOffset = dimX * count + dimX/2 - 1;
    let minOffset = -dimX/2 + 1;

    offset = (typeof x === 'number') ? x : offset; //move to x
    offset = offset > maxOffset ? maxOffset : offset;
    offset = offset < minOffset ? minOffset : offset;
    let center = Math.floor((offset + dimX / 2) / dimX); //the image to show at the centre;
    let delta = offset - center * dimX; //how close to the centred the cental element is
    let dir = (delta < 0) ? 1 : -1; //moving left or right? (left=positive)
    let tween = -dir * delta * 2 / dimX; //proportion between properly centered and fully rotated to show central element

    //basic centering of everything
    var alignment = 'translateX(' + (parseInt(_root.clientWidth) - dimX) / 2 + 'px) ';
    alignment += 'translateY(' + (parseInt(_root.clientHeight) - dimY) / 2 + 'px)';

    //central element
    let el = thumbnailElements[center];
    el.style[xform] = alignment +
      ' translateX(' + (-delta / 2) + 'px)' + //account for off-centre
      ' translateX(' + (dir * shift * tween) + 'px)' + //partial shift from center
      ' translateZ(' + (dist * tween) + 'px)' + //partial going backwards
      ' rotateY(' + (dir * angle * tween) + 'deg)'; //partial rotation
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
        ' rotateY(' + -angle + 'deg)';
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
        ' rotateY(' + angle + 'deg)';
      el.style.zIndex = -i;
      i++;
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
      e.style.height='200px';
      e.style.width='125px';
      e.style.backgroundColor = `rgba(${grey},${grey},${grey},1)`;
      e.style.border = '2px solid limegreen';
      yield e;
    }
  }

  let g = previewGenerator(6); 
  let e = document.getElementById("coverfluent");
  w.coverflowPreview(e,{
    thumbnails:g,
  });
}(window);
