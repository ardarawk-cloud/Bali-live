const TIKTOK_USERNAME = 'ardamoron';
const BUILD_ID = 'radio-v2-20260923a';

export async function onRequestGet() {
  return Response.json({
    message: 'Success',
    mode: 'cloud',
    username: TIKTOK_USERNAME,
    buildId: BUILD_ID,
  });
}
