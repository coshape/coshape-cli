function getParameterDefinitions() {
  return [{name:'a', caption:'radius', type:'range', initial:10, unit:'mm'},
    {name:'b', caption:'height', type:'range', initial:10, unit:'mm'}];
}

function main(params){
  return cylinder({r1: params.a, r2:0, h: params.b});
}
