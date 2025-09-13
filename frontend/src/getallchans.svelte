<script>
    import { currentForm, currentName } from "./stores.js";
    import Formadd from "./formadd.svelte";
    import { onMount } from "svelte";
    import Chancard from "./chancard.svelte";

    let chanskeys = [];
    let chans = {};

    const updateChans = async () => {
        const res = await fetch("http://localhost:3013/api/ch");
        const a = await res.json();
        chans = a;
        chanskeys = Object.keys(a);
    };

    onMount(async () => {
        await updateChans();
    });

    const manageDelete = async (chankey) => {
        const res = await fetch("http://localhost:3013/api/ch", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ target: chankey }),
        });

        await updateChans();
    };
    const manageConfig = (currentchankey, currentchan) => {
        console.log(currentchankey, currentchan);

        currentForm.set(currentchan);
        currentName.set(currentchankey);
    };
</script>

<main>
    <Formadd update={updateChans}></Formadd>
    <div class="grid">
        {#each chanskeys as chankey}
            <Chancard
                name={chankey}
                data={chans[chankey]}
                Delete={() => {
                    manageDelete(chankey);
                }}
                config={() => {
                    manageConfig(chankey, chans[chankey]);
                }}
            ></Chancard>
        {/each}
    </div>
</main>

<style>
    .grid {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr 1fr;
        gap: 20px;
        margin-top: 20px;
    }
</style>
