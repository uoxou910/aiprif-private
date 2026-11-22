/**
 * Site B — public 4-digit PIN gateway
 *
 * Install this file as a NEW .gs file in the EXISTING Site B Apps Script project.
 * Do not paste the public PIN in GitHub or this source.
 *
 * Existing Code.gs must rename exactly two top-level functions:
 *   function doGet(e)  -> function siteBOriginalDoGet(e)
 *   function doPost(e) -> function siteBOriginalDoPost(e)
 *
 * This file supplies replacement doGet/doPost functions.
 * Admin POST actions are delegated unchanged to siteBOriginalDoPost.
 * ALL GET requests are denied to prevent bypassing the PIN.
 * PIN public list is fetched from the original list handler server-side.
 *
 * Add script property SITE_B_PUBLIC_PIN = a four-digit string (including 0 prefixes).
 * Re-deploy the existing web app with a new version, same /exec URL.
 */

const SITE_B_PUBLIC_TOKEN_SECONDS=21600; // 6 hours, refreshed on successful list calls

function siteBPinJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function siteBPinProperty_() {
  const pin=PropertiesService.getScriptProperties().getProperty('SITE_B_PUBLIC_PIN');
  if(!/^[0-9]{4}$/.test(pin||''))throw new Error('SITE_B_PUBLIC_PIN が未設定です');
  return pin;
}

function siteBPinIssue_(submitted) {
  const actual=siteBPinProperty_();
  if(String(submitted==null?'':submitted)!==actual)
    return siteBPinJson_({ok:false,error:'PINコードが違います'});
  const token=Utilities.getUuid().replace(/-/g,'')+
              Utilities.getUuid().replace(/-/g,'');
  CacheService.getScriptCache().put('site_b_pin_'+token,'1',SITE_B_PUBLIC_TOKEN_SECONDS);
  return siteBPinJson_({ok:true,token,expiresIn:SITE_B_PUBLIC_TOKEN_SECONDS});
}

function siteBPinAuthorize_(token) {
  if(typeof token!=='string'||!/^[a-f0-9]{64}$/i.test(token))return false;
  const cache=CacheService.getScriptCache();
  const key='site_b_pin_'+token;
  if(cache.get(key)!=='1')return false;
  cache.put(key,'1',SITE_B_PUBLIC_TOKEN_SECONDS);
  return true;
}

function doGet(e) {
  // Never expose cards/URLs through the old publicly callable GET list endpoint.
  return siteBPinJson_({ok:false,error:'PIN_REQUIRED'});
}

function doPost(e) {
  const params=e&&e.parameter||{};
  const action=String(params.action||'');
  try {
    if(action==='pinLogin') {
      return siteBPinIssue_(params.pin);
    }
    if(action==='pinList') {
      if(!siteBPinAuthorize_(params.token))
        return siteBPinJson_({ok:false,error:'PIN_REQUIRED'});
      // Call the EXISTING public-list implementation internally only after auth.
      // There is no public GET route to reach it.
      return siteBOriginalDoGet({
        parameter:{action:'list'},
        parameters:{action:['list']},
        queryString:'action=list',
        contentLength:-1
      });
    }
    // Leave admin auth, upload, update, visibility and deletion untouched.
    return siteBOriginalDoPost(e);
  }catch(error) {
    return siteBPinJson_({ok:false,error:String(error&&error.message||error)});
  }
}
