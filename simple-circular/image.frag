#version 130

#define pixel_fill $Bar_angle
#define pixel_empty $Gap_angle
#define radius $Radius
#define arc_start $Arc_start
#define arc_end $Arc_end
#define flip $Inside-out


//credit for this function goes to rbn42
vec4 mean(float _from,float _to) {
    if(_from>1.0)
        return vec4(0);

    _from=iChannelResolution[1].x*_from;
    _to=iChannelResolution[1].x*_to;

    vec4 v=texelFetch(iChannel1, ivec2(_from,0),0) * (1.0-fract(_from)) ;

    for(float i=ceil(_from); i<floor(_to); i++)
        v+=texelFetch(iChannel1, ivec2(i,0),0) ;

    if(floor(_to)>floor(_from))
        v+=texelFetch(iChannel1,ivec2(_to,0),0)* fract(_to);
    else
        v-=texelFetch(iChannel1,ivec2(_to,0),0)*(1.0- fract(_to));

    return v/(_to-_from);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    //making uv
    float aspect = iResolution.x/iResolution.y;
    vec2 uv= fragCoord/iResolution.xy;
    uv -= vec2(.5);

    if(iResolution.x>iResolution.y)
        uv.x *= aspect;
    if(iResolution.x<iResolution.y)
        uv.y /= aspect;
    uv = vec2(degrees(radians(180.)-atan(uv.x,-uv.y)),length(uv)*2.);

    //let's gooooooooo
    fragColor = vec4(0.);
    float height_g=1.-radius;
    float rad=radius;
    float unit = pixel_fill+pixel_empty;

    if(mod((uv.x-arc_start),unit)<pixel_fill && uv.x>arc_start && uv.x<arc_end){
        //can't find better solution than wrap rbn42's bar shader
        float id=floor((uv.x-arc_start)/unit);
        float arc=arc_end-arc_start;
        vec3 rgb=getRGB(id*unit/arc);
        vec4 sample1=mean(id*unit/arc,(id+1.)*unit/arc);
        float height=(sample1.r*.5+sample1.g*.5)*height_g;

        if(bool(flip)){
            if(uv.y>=0.99 && uv.y<=1.) fragColor=vec4(rgb*1.,1.);
            if(uv.y>=0.99-height && uv.y<=0.99) fragColor=vec4(rgb*1.,1.);
        }else{
            if(uv.y>=rad-0.01 && uv.y<=rad) fragColor=vec4(rgb*1.,1.);
            if(uv.y>=rad && uv.y<=rad+height) fragColor=vec4(rgb*1.,1.);
        }
    }

}
