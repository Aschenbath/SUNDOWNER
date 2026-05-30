export async function onRequest(context) {
    // Contents of context object
    const {
      request, // same as existing Worker API
      env, // same as existing Worker API
      params, // if filename includes [id] or [[path]]
      waitUntil, // same as ctx.waitUntil in existing Worker API
      next, // used for middleware or to fetch assets
      data, // arbitrary space for passing data between middlewares
    } = context;
    try {
        const res = await fetch(`https://cn.bing.com/HPImageArchive.aspx?format=js&idx=0&n=5`);
        if (!res.ok) {
            return new Response(JSON.stringify({ status: false, message: `Bing upstream error: ${res.status}` }), { status: 502 });
        }
        const bing_data = await res.json();
        if (!Array.isArray(bing_data?.images)) {
            return new Response(JSON.stringify({ status: false, message: 'Unexpected Bing response shape' }), { status: 502 });
        }
        const return_data = { status: true, message: '操作成功', data: bing_data.images };
        return new Response(JSON.stringify(return_data));
    } catch (err) {
        return new Response(JSON.stringify({ status: false, message: 'Failed to fetch Bing wallpaper' }), { status: 502 });
    }

  }