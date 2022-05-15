#version 130

#define Edit $Edit_points
#define propscal $Proportional_scaling
#define updt $Update_UV_every_frame
#define mvcen $Move_center_only

#define SnapAng $Snap_to_i*15_angle
//setup definitions
#define onSkipp if(!Edit)
#define onStart if(Edit && state.z != -9.8)
#define onSetup if(state.z != -9.8)
#define newpoint(px,py) {if(pos.x == 2+count){fragColor = setpoint(vec4(px,py,0.,0.),pos.y);return;} count +=1;}
//drag definitions
#define onClick if(state.z == -9.8 && mouse_old.z < 0. && mouse_new.z > 0.)
#define onDragp if(state.z == -9.8 && mouse_old.z > 0. && mouse_new.z > 0.)

//points
#define P1x $P1x
#define P1y $P1y
#define P2x $P2x
#define P2y $P2y
#define P3x $P3x
#define P3y $P3y
#define P4x $P4x
#define P4y $P4y

//state: number,active,state

vec4 getpoint(in int x){
    return (texelFetch(iChannel2,ivec2(x,0),0)*2.-1.)*(texelFetch(iChannel2,ivec2(x,1),0) + texelFetch(iChannel2,ivec2(x,2),0)*255.)/8.;
}

vec4 setpoint(in vec4 val,in float h){
    vec4 col = vec4(0.);
    if(h == 0) col = sign(val);
    if(h == 1) col = fract(abs(val*8.));//*4 т.к. разрешение всего 1/255
    if(h == 2) col = floor(abs(val*8.))/255.;
    return col;
}

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

float getangle(in vec2 v1,in vec2 v2){
    float dotp = v1.x*v2.x + v1.y*v2.y;
    float detp = v1.x*v2.y - v1.y*v2.x;
    return atan(detp,dotp);
}


vec2 rotate(in vec2 center,in vec2 point,in float angle){
    float c = cos(angle);
    float s = sin(angle);
    mat2 matrix = mat2(c,-s,s,c);
    point -= center;
    point *= matrix;
    point += center;
    return point;
}

float pval(in vec2 point,in vec2 a,in vec2 b){
    vec2 m = b - a;
    return dot(point - a, m)/dot(m,m);
}
vec2 pval2p(in float pval,in vec2 a,in vec2 b){
    vec2 m = b - a;
    return a + pval*m;
}
vec2 proj2l(in vec2 point,in vec2 a,in vec2 b){
    vec2 m = b - a;
    return a+dot(point - a, m)/dot(m,m)*m;
}

float snapto(in float val,in float snap,in float dist){
    if(abs(val-snap)<dist) val = snap;
    return val;
}

//got idea from https://blog.mbedded.ninja/mathematics/geometry/projective-transformations/

mat3 getproj(in vec2 p1,in vec2 p2,in vec2 p3,in vec2 p4){

    vec2 quadF[4];
    vec2 quadT[4];

    quadF[0] = p1; quadT[0] = vec2(-1.,-1.);
    quadF[1] = p2; quadT[1] = vec2( 1.,-1.);
    quadF[2] = p3; quadT[2] = vec2( 1., 1.);
    quadF[3] = p4; quadT[3] = vec2(-1., 1.);

    float mat[64];
    float args[8];
    float ratio;
    int used[8];
    int iptr[8];
    //fill in matrix
    for(int i=0;i<4;i++){
        mat[8*(i*2+0)+0] = quadF[i].x; mat[8*(i*2+0)+1] = quadF[i].y; mat[8*(i*2+0)+2] = 1.;
        mat[8*(i*2+0)+3] = 0.;         mat[8*(i*2+0)+4] = 0.;         mat[8*(i*2+0)+5] = 0.;
        mat[8*(i*2+1)+0] = 0.;         mat[8*(i*2+1)+1] = 0.;         mat[8*(i*2+1)+2] = 0.;
        mat[8*(i*2+1)+3] = quadF[i].x; mat[8*(i*2+1)+4] = quadF[i].y; mat[8*(i*2+1)+5] = 1.;
        mat[8*(i*2+0)+6] = - quadF[i].x * quadT[i].x; mat[8*(i*2+0)+7] = - quadF[i].y * quadT[i].x;
        mat[8*(i*2+1)+6] = - quadF[i].x * quadT[i].y; mat[8*(i*2+1)+7] = - quadF[i].y * quadT[i].y;
        args[i*2+0] = quadT[i].x; args[i*2+1] = quadT[i].y;
        used[i*2+0] = 0;          used[i*2+1] = 0;
    }
    //solving first 6 columns
    for(int i=0;i<6;i++){
        int j;
        //find non zero
        j=0;
        if(i>2) j=1;
        for(;j<8;j+=2){
            if(used[j] == 0 && mat[8*j+i] !=0){
                used[j] = 1;
                iptr[i] = j;
                j = 8;
            }
        }
        //use it to solve
        j=0;
        if(i>2) j=1;
        for(;j<8;j+=2){
            if(j != iptr[i] && mat[8*j+i] != 0){
                ratio = mat[8*j+i] / mat[8*iptr[i]+i];
                mat[8*j+6] -= mat[8*iptr[i]+6]*ratio;
                mat[8*j+7] -= mat[8*iptr[i]+7]*ratio;
                args[j] -= args[iptr[i]]*ratio;
                if(i<3){
                    mat[8*j+0] -= mat[8*iptr[i]+0]*ratio;
                    mat[8*j+1] -= mat[8*iptr[i]+1]*ratio;
                    mat[8*j+2] -= mat[8*iptr[i]+2]*ratio;
                }else{
                    mat[8*j+3] -= mat[8*iptr[i]+3]*ratio;
                    mat[8*j+4] -= mat[8*iptr[i]+4]*ratio;
                    mat[8*j+5] -= mat[8*iptr[i]+5]*ratio;
                }
            }
        }
        if(mat[8*iptr[i]+i] != 1.0){
            ratio = 1./mat[8*iptr[i]+i];
            args[iptr[i]] *= ratio;
            mat[8*iptr[i]+6] *= ratio;
            mat[8*iptr[i]+7] *= ratio;
            if(i<3){
                mat[8*iptr[i]+0] *= ratio;
                mat[8*iptr[i]+1] *= ratio;
                mat[8*iptr[i]+2] *= ratio;
            }else{
                mat[8*iptr[i]+3] *= ratio;
                mat[8*iptr[i]+4] *= ratio;
                mat[8*iptr[i]+5] *= ratio;
            }
            mat[8*iptr[i]+i] = 1.;
        }
    }
    //solving last 2 columns
    for(int i=6;i<8;i++){
        for(int j=0;j<8;j++){
            if(used[j] == 0 && mat[8*j+i] !=0){
                used[j] = 1;
                iptr[i] = j;
                j = 8;
            }
        }

        for(int j=0;j<8;j++){
            if(j != iptr[i] && mat[8*j+i] != 0){
                ratio = mat[8*j+i] / mat[8*iptr[i]+i];
                mat[8*j+6] -= mat[8*iptr[i]+6]*ratio;
                mat[8*j+7] -= mat[8*iptr[i]+7]*ratio;
                args[j] -= args[iptr[i]]*ratio;
            }
        }

        if(mat[8*iptr[i]+i] != 1.0){
            ratio = 1./mat[8*iptr[i]+i];
            args[iptr[i]] *= ratio;
            mat[8*iptr[i]+6] *= ratio;
            mat[8*iptr[i]+7] *= ratio;
            mat[8*iptr[i]+i] = 1.;
        }
    }
    //assemble to get identity matrix
    float narg[8];
    for(int i=0;i<8;i++) narg[i] = args[iptr[i]];

    return mat3(narg[0],narg[1],narg[2],narg[3],narg[4],narg[5],narg[6],narg[7],1.);
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    //boundaries set
    ivec2 pos = ivec2(fragCoord);
    if(pos.y>2){fragColor = vec4(0.);return;}
    vec4 state = getpoint(0);
    if(state.x>0 && pos.x>1+state.x){fragColor = vec4(0.);return;}
    //mouse action
    vec4 mouse_new = vec4(pos2uv(iMouse.xy),sign(iMouse.z),0.);
    vec4 mouse_old = getpoint(1);
    if(distance(mouse_new.xy,mouse_old.xy) < pix2uv(1.)) mouse_new.xy = mouse_old.xy;
    //setup
    onSkipp state.z = 1.;
    onStart state.z = -9.8;
    onSetup{
        int count = 0;
        //set points
        newpoint(P1x,P1y);
        newpoint(P2x,P2y);
        newpoint(P3x,P3y);
        newpoint(P4x,P4y);
        //modification points
        newpoint(0.,0.);//global move & rotation center
        newpoint(.4,.4);//rotation point
        //scale drag points
        newpoint(.5,0.);
        newpoint(0.,.5);
        //scale ancor points
        newpoint(1.,0.);
        newpoint(0.,1.);
        //transform matrix points
        if(pos.x > 11 && pos.x < 15){
            mat3 projmat = getproj(vec2(P1x,P1y),vec2(P2x,P2y),vec2(P3x,P3y),vec2(P4x,P4y));
            if(pos.x == 12){fragColor = setpoint(vec4(projmat[0],1.),pos.y);return;}
            if(pos.x == 13){fragColor = setpoint(vec4(projmat[1],1.),pos.y);return;}
            if(pos.x == 14){fragColor = setpoint(vec4(projmat[2],1.),pos.y);return;}
        }
        count+=3;
        //set number of points
        state.x = float(count);
        state.y = 0.;
        state.z = 2.;
    }
    //drag action
    if(pos.x == 0){
        onClick{//define active point
            float radius = pix2uv(10.);
            float rad = radius * 1.05;
            for(int i=2;i<10;i++){
                vec4 point = getpoint(i);
                float dist = distance(point.xy,mouse_new.xy);
                if(dist < rad){
                    rad = dist;
                    state.y = float(i);
                }
            }
            if(rad > radius) state.y = 0.;
        }
        fragColor = setpoint(state,pos.y);
        return;
    }
    if(pos.x == 1){fragColor = setpoint(mouse_new,pos.y);return;}
    if(pos.x > 1 && pos.x < 12){//we don't wanna touch state,mouse and service points
        vec4 point = getpoint(pos.x);
        onDragp{//drag points around
            //normal drag + drag all
            if((state.y == float(pos.x) && pos.x < 6) || state.y == 6.){
                if(!mvcen) point.xy += mouse_new.xy - mouse_old.xy;
                if(mvcen && state.y == 6. && pos.x > 5) point.xy += mouse_new.xy - mouse_old.xy;
            }
            vec2 center = getpoint(6).xy;
            //spindle
            if(state.y == 7. && pos.x != 6){
                vec2 rotor = getpoint(7).xy;
                float angle_old = getangle(rotor - center,vec2(1.,0.));
                float angle_new = getangle(mouse_new.xy - center,vec2(1.,0.));
                angle_new = radians(.5)*round(angle_new/radians(.5));
                angle_old = radians(.5)*round(angle_old/radians(.5));
                angle_new = snapto(angle_new,radians(-135.),radians(2.));
                angle_new = snapto(angle_new,radians( -45.),radians(2.));
                angle_new = snapto(angle_new,radians(  45.),radians(2.));
                angle_new = snapto(angle_new,radians( 135.),radians(2.));
                if(SnapAng){
                    for(int i=0;i<13;i++){
                        angle_new = snapto(angle_new,radians(-15.*i),radians(4.));
                        angle_new = snapto(angle_new,radians( 15.*i),radians(4.));
                    }
                }



                point.xy = rotate(center,point.xy,angle_old-angle_new);
            }
            //stretchy stretch
            if(state.y == 8. || state.y == 9.){
                vec2 ancorh = getpoint(10).xy;
                vec2 ancorv = getpoint(11).xy;
                vec2 ancorc = ancorh;
                if(state.y == 9.) ancorc = ancorv;
                float pval_old = pval(mouse_old.xy,center,ancorc);
                float pval_new = pval(mouse_new.xy,center,ancorc);
                //division by 0 fix?
                if(pval_old == 0.) pval_old = 0.05;
                if(abs(pval_old)<0.05) pval_old = 0.05*sign(pval_old);
                if(pval_new == 0.) pval_new = 0.05;
                if(abs(pval_new)<0.05) pval_new = 0.05*sign(pval_new);

                pval_old = snapto(pval_old,.5,.025);
                pval_new = snapto(pval_new,.5,.025);
                pval_old = snapto(pval_old,1.,.025);
                pval_new = snapto(pval_new,1.,.025);
                pval_old = snapto(pval_old,.25,.025);
                pval_new = snapto(pval_new,.25,.025);

                //appy position change
                if((state.y == 8. || propscal) && (pos.x == 8 || pos.x < 6)){
                    vec2 proj = proj2l(point.xy,center,ancorv);
                    point.xy = (point.xy - proj)*pval_new/pval_old + proj;
                    if(pos.x == 8) point.xy = pval2p(pval_new,center,ancorh);
                }
                if((state.y == 9. || propscal) && (pos.x == 9 || pos.x < 6)){
                    vec2 proj = proj2l(point.xy,center,ancorh);
                    point.xy = (point.xy - proj)*pval_new/pval_old + proj;
                    if(pos.x == 9) point.xy = pval2p(pval_new,center,ancorv);
                }
            }
        }
        fragColor = setpoint(point,pos.y);
        return;
    }
    //recalculate matrix on demand
    if(pos.x > 11 && pos.x < 15){
        vec4 point = getpoint(pos.x);
        bool update = (state.z == -9.8 && mouse_old.z > 0.);
        if(!updt) update = (update && mouse_new.z < 0.);
        if(update){
            mat3 projmat = getproj(getpoint(2).xy,getpoint(3).xy,getpoint(4).xy,getpoint(5).xy);
            if(pos.x == 12) point = vec4(projmat[0],1.);
            if(pos.x == 13) point = vec4(projmat[1],1.);
            if(pos.x == 14) point = vec4(projmat[2],1.);
        }
        fragColor = setpoint(point,pos.y);
        return;
    }
}
