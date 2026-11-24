def run(api):
 import numpy as np
 for i in range(240):
  o=api.observe(); a=o.rgb
  # Blue hull pixels near the bottom identify current horizontal position.
  m=(a[560:680,:,2]>100)&(a[560:680,:,0]<130)&(a[560:680,:,1]>70)
  yy,xx=np.where(m); x=float(np.median(xx)) if len(xx)>10 else 640
  # Bright magenta/red projectiles, excluding the side HUD.
  b=(a[:,:,0]>235)&(a[:,:,1]<115)&(a[:,:,2]>35)
  b[:300]=False; b[:, :100]=False; b[:,1180:]=False
  by,bx=np.where(b)
  near=(abs(bx-x)<150)&(by>390)
  if np.any(near):
   threat=float(np.mean(bx[near])); direction='ArrowRight' if threat<x else 'ArrowLeft'
  else:
   direction='ArrowRight' if (i//22)%2==0 else 'ArrowLeft'
  if x<220: direction='ArrowRight'
  if x>1060: direction='ArrowLeft'
  api.act({'action':'press_keys','keys':['x',direction],'duration':0.18})
 api.request_handoff('Short firing/dodging trial finished; inspect score and lives.')