#version 130

#define AAlvl $AntiAliasing_factor

//arc mods
#define radius $Inner_radius
#define arc_begin_g $Arc_start_angle
#define arc_endin_g $Arc_end_angle
#define angle_2fill $Angle_fill
#define angle_empty $Angle_empty

#define uvmod $Enable_UV_modificators
#define parts $Divide_UV_into_parts
#define mirror $Mirror_every_second_part
#define rotation $UV_rotation
#define offset_x $UV_offset_x
#define offset_y $UV_offset_y
#define scale_x $UV_scale_x
#define scale_y $UV_scale_y
#define resol_x $UV_resolution_multiplier


#define visualmod $Enable_visualiser_modificators
#define flip $Flip_inside-out
#define body $Show_body
#define decor $Show_decorators
#define rnded $Make_decorators_rounded
#define even $Make_bars_even_width
#define drift_start $Drift_offset
#define angle_drift $Drift_multiplier
//that's all for definitions


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

vec2 uv_old(vec2 p,float part){
    if(uvmod){
        p.x /= resol_x;
        if(mirror && mod(part,2.)>0.) p.x = 360./parts - p.x;
        p.x += 360.*part/parts;
    }
    p = p.y*vec2(sin(radians(p.x-180.)),cos(radians(p.x-180.)));
    p.y *= -1.;
    return p;
}

vec4 fC( in vec2 fragCoord )
{
    vec4 fragColor;
    //making uv aka uv hell begins here
    float aspect = iResolution.x/iResolution.y;
    vec2 uv= fragCoord/iResolution.xy;
    uv -= vec2(.5);
    uv *= 2.;

    //scaling according to screen size
    if(iResolution.x>iResolution.y)
        uv.x *= aspect;
    if(iResolution.x<iResolution.y)
        uv.y /= aspect;

    if(uvmod){
        //rOtAtE + Scale + offset
        float c=cos(radians(rotation));
        float s=sin(radians(rotation));
        uv = (mat2(c,-s,s,c)*uv-vec2(offset_x,offset_y))*vec2(1./scale_x,1./scale_y);
    }
    //going polar
    vec2 uvc = uv;
    uv = vec2(degrees(radians(180.)+atan(uv.x,-uv.y)),length(uv));

    //dividing into parts
    float part = 0.;
    if(parts > 1. && uvmod){
        part = floor(uv.x*parts/360.);
        uv.x = mod(uv.x,360./parts);
        if(mirror && mod(part,2.)>0.) uv.x = 360./parts - uv.x;
    }
    if(uvmod) uv.x *= resol_x;

    //uv hell ends here
    fragColor = vec4(0);

    //basic stuff
    float height = 1. - radius;
    float unit = angle_2fill+angle_empty;

    //arc correction
    float arc_begin = arc_begin_g;
    float arc_endin = arc_endin_g;
    if(arc_begin_g < 0.) arc_begin = 0.;
    if(arc_endin_g > 360.*resol_x/parts) arc_endin = 360.*resol_x/parts;
    //straitning lines
    float ang_begin = 0.;
    float ang_endin = angle_2fill;
    if(even) ang_endin *= radius/uv.y;
    ang_begin += (unit-ang_endin)/2.;
    ang_endin += ang_begin;

    //point drift goes brrrr
    float drift = 0.;
    if(visualmod) drift = iTime * angle_drift+drift_start;
    drift = mod(drift,unit);

    //Let's draw this
    if (mod(uv.x - arc_begin - drift,unit) > ang_begin && uv.x > arc_begin &&
        mod(uv.x - arc_begin - drift,unit) < ang_endin && uv.x < arc_endin){

        float id = floor((uv.x - arc_begin - drift)/unit);

        float arc = arc_endin - arc_begin + unit;

        //gettin color
        vec3 rgb = getRGB(id*unit/arc);

        //gettin height
        vec4 sound = mean(((id+1.)*unit+drift)/arc,((id+2.)*unit+drift)/arc);
        height *= (sound.r +sound.g)*.5;

        float xoc = unit*(id+.5)+arc_begin+drift;
        float t;

        if(visualmod){
            //main body draw
            if(flip){
                if(uv.y >= 1.-height && uv.y <= 1. && body) fragColor=vec4(rgb,1.);
            }else{
                if(uv.y>=radius && uv.y<=radius+height && body) fragColor=vec4(rgb,1.);
            }

            //gettin ready for decorators
            if(flip){
                t = 1.;
                if(uv.y < 1.-height) t = 1. -height;
                if(uv.y > 1.) t = 1.;
            }else{
                t = radius;
                if(uv.y < radius) t = radius;
                if(uv.y > radius+height) t = radius+height;
            }
            float rad = t*sin(radians((ang_endin-ang_begin)/2.));
            if(uvmod) rad /= resol_x;
            //not rounded decorators
            if(uv.y > radius*(1.- sin(radians(angle_2fill)))){
                if(flip){
                    if(uv.y >= 1.- rad && uv.y <= 1.+ rad && decor && !rnded) fragColor=vec4(rgb,1.);
                    if(uv.y >= 1.- height- rad && uv.y <= 1.- height && decor && !rnded) fragColor=vec4(rgb,1.);
                }else{
                    if(uv.y>=radius -rad && uv.y<=radius +rad && decor && !rnded) fragColor=vec4(rgb,1.);
                    if(uv.y>=radius+ height && uv.y<=radius+ height +rad && decor && !rnded) fragColor=vec4(rgb,1.);
                }
            }

            //rounded decorators
            if(decor && rnded && uv.y > radius*(1.- sin(radians(angle_2fill)))){
                if(length(uv_old(vec2(xoc,t),part)-uvc)<rad) fragColor = vec4(rgb,1.);
            }
        }else{
            if(uv.y>=radius && uv.y<=radius+height) fragColor=vec4(rgb,1.);
        }
    }
    return fragColor;
}


//AA solution found here https://www.shadertoy.com/view/wtjfRV
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    fragColor = vec4(0);
    float A=AAlvl;
    float s = 1./A;
    float  x, y;
    if(A>1.){
        for (x=-.5; x<.5; x+=s) for (y=-.5; y<.5; y+=s) fragColor += min ( fC(vec2(x,y)+fragCoord), 1.0);

        fragColor /= A*A;
    }else{
    fragColor = fC(fragCoord);
    }
}
