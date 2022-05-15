#version 130

#define Edit $Edit_points

#define defarcn $Divide_circle_into_N_arcs
#define defarcm $Mirror_every_2'nd_arc
#define defarcb $Arc_begin_%
#define defarce $Arc_end_%

#define defUnits $Number_of_units
#define defFillp $Unit_fill_%
#define defInRad $Inner_radius

#define defFlip $Flip_inside-out
#define defBars $Show_bars
#define defDeco $Show_decorators
#define defEven $Make_bars_even_width
#define defRndd $Round_decorators
#define defFitL $Fit_in_low
#define defFitH $Fit_in_high
#define defDrft $Drift_factor

#define defAAfa $AntiAliasing_factor

#define POCx $POCx
#define POCy $POCy
#define POVx $POVx
#define POVy $POVy

#define statePos 10
#define PI 3.1415926538
#define vals $Show_values

vec2 pos2uv(in vec2 coord){
    float aspect = iResolution.x/iResolution.y;
    vec2 uv = coord*2./iResolution.xy - 1.;
    if(aspect > 1.) uv.x *= aspect;
    if(aspect < 1.) uv.y /= aspect;
    return uv;
}

float pix2uv(in float pix){
    float res;
    if(iResolution.x < iResolution.y){
        res = pix*2./iResolution.x;
    }else{
        res = pix*2./iResolution.y;
    }
    return res;
}

vec4 getpoint(in int x){
    return (texelFetch(iChannel2,ivec2(x,0),0)*2.-1.)*(texelFetch(iChannel2,ivec2(x,1),0) + texelFetch(iChannel2,ivec2(x,2),0)*255.)/8.;
}

float segment(vec2 P, vec2 A, vec2 B, float r)
{
    vec2 g = B - A;
    vec2 h = P - A;
    float d = length(h - g * clamp(dot(g, h) / dot(g,g), 0.0, 1.0));
	return smoothstep(r, 0.5*r, d);
}

//printing values is slightly modified version of https://www.shadertoy.com/view/lt3GRj

vec2 DigitBin(const in int x){
	vec2 res = vec2(0.);
	if(x == 0) res = vec2(608844.,12882.);
	if(x == 1) res = vec2(270600.,8586.);
	if(x == 2) res = vec2(532638.,12880.);
	if(x == 3) res = vec2(279116.,12880.);
	if(x == 4) res = vec2(999952.,19026.);
	if(x == 5) res = vec2(999950.,30786.);
	if(x == 6) res = vec2(477772.,12354.);
	if(x == 7) res = vec2(270468.,31248.);
	if(x == 8) res = vec2(412236.,12882.);
	if(x == 9) res = vec2(934412.,12882.);
    return res;
}

float PrintValue(vec2 fragCoord,vec2 startCoord,vec2 fontSize,float value,float digits,float decimals) {
	vec2 charCoord = (fragCoord - startCoord) / fontSize;
	if(charCoord.y < 0.0 || charCoord.y >= 1.0) return 0.0;
	vec2 bits = vec2(0.);
	float digitIndex1 = digits - floor(charCoord.x)+ 1.0;
	if(- digitIndex1 <= decimals) {
		float pow1 = pow(10.0, digitIndex1);
		float absValue = abs(value);
		float pivot = max(absValue, 1.5) * 10.0;
		if(pivot < pow1) {
			if(value < 0.0 && pivot >= pow1 * 0.1) bits.x = 458752.;
		} else if(digitIndex1 == 0.0) {
			if(decimals > 0.0) bits.x = 4.0;
		} else {
			value = digitIndex1 < 0.0 ? fract(absValue) : absValue * 10.0;
			bits = DigitBin(int (mod(value / pow1, 10.0)));
		}
	}
	float res;
	if(charCoord.y * 7. < 4.){
		res = floor(mod(bits.x / pow(2.0, floor(fract(charCoord.x) * 5.) + floor(charCoord.y * 7.) * 5.), 2.0));
	}else{
		res = floor(mod(bits.y / pow(2.0, floor(fract(charCoord.x) * 5.) + (floor(charCoord.y * 7.) - 4.)* 5.), 2.0));
	}
	return res;
}

vec2 toNUV(in int arcN,in bool mirr,in vec2 puv){
    if(defarcb > 0. || defarce < 100.){
        float mul = (defarce-defarcb)/100.;
        float drt = PI*2.*defarcb/100.;
        puv.x = puv.x*mul + drt;
    }

    if(defarcn > 1){
        if(mirr) puv.x = PI*2. - puv.x;
        puv.x = (puv.x + PI*2.*arcN)/defarcn;
    }
    return vec2(puv.y * sin(puv.x),puv.y * cos(puv.x));
}

float getH(){
    return clamp(0.,1.,iMouse.y/iResolution.y);
}

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


vec4 DrawSpectrum( in vec2 fragCoord ){
    vec2 uv = pos2uv(fragCoord);
    vec4 col = vec4(0.);
    mat3 Tmat;
    Tmat[0] = getpoint(12).xyz;
    Tmat[1] = getpoint(13).xyz;
    Tmat[2] = getpoint(14).xyz;
    Tmat = transpose(Tmat);
    vec3 iuv = Tmat*vec3(uv,1.);
    vec2 cuv = uv;
    uv = iuv.xy/iuv.z;
    vec2 puv = vec2(atan(-uv.x,-uv.y) + PI,length(uv));
    if(puv.y > 1.7) return vec4(0.);
    //form arcs
    float radP = clamp(0.,1.,defInRad);

    vec2 POC = vec2(POCx,POCy);
    vec2 POV = vec2(POVx,POVy);

    if(Edit){
        float x;
        float w = pix2uv(.8);
        x = abs(puv.y - radP);
        if(x < w) col = vec4(0.,0.,1.,1.);
        x = abs(puv.y - 1.);
        if(x < w) col = vec4(0.,0.,1.,1.);
        x = abs(puv.x - PI/2.)/puv.y;
        if(x < w) col = vec4(0.,0.,1.,1.);
        x = abs(puv.x - PI)/puv.y;
        if(x < w) col = vec4(0.,0.,1.,1.);
        x = abs(puv.x - PI*3./2.)/puv.y;
        if(x < w) col = vec4(0.,0.,1.,1.);
        x = abs(puv.x - PI*2.)/puv.y;
        if(x < w) col = vec4(0.,0.,1.,1.);
        x = abs(puv.x)/puv.y;
        if(x < w) col = vec4(0.,0.,1.,1.);

        if(POC != POV && distance(cuv,POC) <= distance(POV,POC) && dot(cuv,POV) > 0.) col = vec4(1.,0.,0.,1.);

        return col;
    }
    if(POC != POV && distance(cuv,POC) <= distance(POV,POC) && dot(cuv,POV) > 0.) return vec4(0.);
    bool mirrored = false;
    int arcN = 0;
    if(defarcn > 1){
        arcN = int(puv.x*defarcn/(PI*2.));
        if(defarcm && arcN%2 == 1) mirrored = true;
        puv.x = mod(puv.x*defarcn,PI*2.);
        if(mirrored) puv.x = PI*2. - puv.x;
    }
    if(defarcb > 0. || defarce < 100.){
        float mul = 100./(defarce-defarcb);
        float drt = PI*2.*defarcb/100.;
        puv.x = (puv.x - drt)*mul;
    }
    //form bars
    int numd = clamp(6,1000,defUnits);
    float unit = PI*2./numd;
    float filP = clamp(0.,1.,defFillp/100.);
    float fill = unit*filP;
    if(defEven) fill *= radP/puv.y;
    //
    float abegin = (unit-fill)/2.;
    float aendin = unit - abegin;

    float drift = mod(iTime*defDrft*defarcn*abs(defarce-defarcb)/100.,unit);

    if(puv.x < 0. || puv.x > PI*2. || mod(puv.x-drift,unit) < abegin || mod(puv.x-drift,unit) > aendin) return vec4(0.);
    if(puv.y > 1. + tan(unit*filP/2.) || puv.y < radP*(1. - tan(unit*filP/2.))) return vec4(0.);

    float id = (puv.x-mod(puv.x-drift,unit))/unit;

    float snapL = radP;
    float snapH = 1.;
    if(!defEven){
        if(defFitL) snapL = snapL/(1. - sin(fill/2));
        if(defFitH) snapH = snapH/(1. + sin(fill/2));
    }else{
        if(defFitL) snapL = snapL + sin(unit*filP/2.)*radP;
        if(defFitH) snapH = snapH - sin(unit*filP/2.)*radP;
    }

    vec4 sound = mean((id+1.)/(numd+1.),(id+2.)/(numd+1.));
    float height = (sound.x + sound.y)/2.;
    vec4 gcol = vec4(getRGB(id/(numd+1.)),1.);

    float radS;
    float radD;
    float endp;

    if(defEven){
        radS = sin(unit*filP/2.)*radP;
        radD = sin(unit*filP/2.)*radP;
    }

    if(!defFlip){
        endp = snapL + (snapH-snapL)*height;
        if(!defEven){radS = tan(unit*filP/2.)*snapL;radD = tan(unit*filP/2.)*endp;}
        if(defBars && puv.y >= snapL && puv.y <= endp) col = gcol;

        radS *= abs(defarce-defarcb)/100./defarcn;
        radD *= abs(defarce-defarcb)/100./defarcn;

        if(defDeco && ((puv.y >= snapL-radS && puv.y <= snapL+radS)||(puv.y >= endp-radD && puv.y <= endp+radD))){
            if(defRndd){
                if(distance(uv,toNUV(arcN,mirrored,vec2(puv.x-mod(puv.x-drift,unit)+unit/2.,endp))) <= radD) col = gcol;
                if(distance(uv,toNUV(arcN,mirrored,vec2(puv.x-mod(puv.x-drift,unit)+unit/2.,snapL))) <= radS) col = gcol;
            }else{
                col = gcol;
            }
        }
    }else{
        endp = snapH - (snapH-snapL)*height;
        if(!defEven){radS = tan(unit*filP/2.)*snapH;radD = tan(unit*filP/2.)*endp;}

        radS *= abs(defarce-defarcb)/100./defarcn;
        radD *= abs(defarce-defarcb)/100./defarcn;

        if(defBars && puv.y <= snapH && puv.y >= endp) col = gcol;

        if(defDeco && ((puv.y >= snapH-radS && puv.y <= snapH+radS)||(puv.y >= endp-radD && puv.y <= endp+radD))){
            if(defRndd){
                if(distance(uv,toNUV(arcN,mirrored,vec2(puv.x-mod(puv.x-drift,unit)+unit/2.,endp))) <= radD) col = gcol;
                if(distance(uv,toNUV(arcN,mirrored,vec2(puv.x-mod(puv.x-drift,unit)+unit/2.,snapH))) <= radS) col = gcol;
            }else{
                col = gcol;
            }
        }
    }

    return col;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{


    vec2 uv = pos2uv(fragCoord);
    float radius = pix2uv(10.);
    vec4 state = getpoint(0);
    vec4 col = vec4(0.);

    float A=clamp(0,16,defAAfa);
    float s = 1./A;
    float  x, y;
    if(A>1.){
        for (x=-.5; x<.5; x+=s) for (y=-.5; y<.5; y+=s) col += min ( DrawSpectrum(vec2(x,y)+fragCoord), 1.0);

        col /= A*A;
    }else{
    col = DrawSpectrum(fragCoord);
    }

    if(vals){
        float parse = floor(iResolution.y/8.);
        float i = 1.;
        if(parse > 16) i = 2.;
        if(parse > 24) i = 3.;
        if(parse > 32) i = 4.;
        float d = floor((parse - 7*i)/2.);
        vec2 fs = vec2(5.,7.) * i;
        col = mix(col,vec4(1.),PrintValue(fragCoord,vec2(0.1,iResolution.y - parse*1. + d),fs,getpoint(2).x,2.,8.));
        col = mix(col,vec4(1.),PrintValue(fragCoord,vec2(0.1,iResolution.y - parse*2. + d),fs,getpoint(2).y,2.,8.));
        col = mix(col,vec4(1.),PrintValue(fragCoord,vec2(0.1,iResolution.y - parse*3. + d),fs,getpoint(3).x,2.,8.));
        col = mix(col,vec4(1.),PrintValue(fragCoord,vec2(0.1,iResolution.y - parse*4. + d),fs,getpoint(3).y,2.,8.));
        col = mix(col,vec4(1.),PrintValue(fragCoord,vec2(0.1,iResolution.y - parse*5. + d),fs,getpoint(4).x,2.,8.));
        col = mix(col,vec4(1.),PrintValue(fragCoord,vec2(0.1,iResolution.y - parse*6. + d),fs,getpoint(4).y,2.,8.));
        col = mix(col,vec4(1.),PrintValue(fragCoord,vec2(0.1,iResolution.y - parse*7. + d),fs,getpoint(5).x,2.,8.));
        col = mix(col,vec4(1.),PrintValue(fragCoord,vec2(0.1,iResolution.y - parse*8. + d),fs,getpoint(5).y,2.,8.));
    }

    if(Edit){
        float seg;
        float wid = pix2uv(2.);

        seg = segment(uv,getpoint(2).xy,getpoint(3).xy,wid/2);
        col = mix(col,vec4(1.),seg);
        seg = segment(uv,getpoint(4).xy,getpoint(3).xy,wid/2);
        col = mix(col,vec4(1.),seg);
        seg = segment(uv,getpoint(4).xy,getpoint(5).xy,wid/2);
        col = mix(col,vec4(1.),seg);
        seg = segment(uv,getpoint(5).xy,getpoint(2).xy,wid/2);
        col = mix(col,vec4(1.),seg);



        for(int i=2;i<10;i++){
            vec4 point = getpoint(i);
            if(distance(uv,point.xy)<=radius){
                if(state.y == float(i)){
                    col = vec4(0.,1.,0.,1.);
                }else{
                    col = vec4(1.);
                }
            }
        }
    }
    fragColor = col;
}
