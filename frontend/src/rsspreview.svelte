<script>
    let { feed } = $props();

    let showfeed = $state(false);

    $effect(() => {
        console.log("feed:");
        console.log(feed);
        try {
            if (feed?.rss?.channel) {
                if (feed.rss.channel.item) {
                    if (feed.rss.channel.item.length) {
                        showfeed = true;
                        return;
                    }
                }
            }
            showfeed = false;
            return;
        } catch (error) {
            console.warn(error);
            showfeed = false;
        }
    });
</script>

<main>
    {#if showfeed}
        {#each feed["rss"]["channel"]["item"] as item}
            <div>
                <h1>{item.title}</h1>
                <div>
                    {@html item.description}
                </div>
            </div>
        {/each}
    {/if}
</main>

<style>
    main {
        max-height: 300px;
        overflow: scroll;
    }
</style>
