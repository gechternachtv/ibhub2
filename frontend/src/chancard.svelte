<script>
    let { name, data, Delete, config } = $props();
</script>

<div>
    <img src={data.icon} alt="" />
    <h1>{name}</h1>
    <a href={data.url}>{data.url}</a>
    <div>{data.container}</div>
    <div>{data.desc}</div>
    <a href="http://localhost:3013/xml/{name}">xml</a>
    <a href="http://localhost:3013/rss/{name}">rss</a>
    <button on:click={Delete}>del</button>
    <button on:click={config}>conf</button>
</div>

<style>
    * {
        font-family: bitbuntu;
        font-size: 12px;
    }
    img {
        max-width: 100px;
    }
</style>
