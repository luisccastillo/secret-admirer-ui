import {
    IExec
} from "iexec";

const WORKERPOOL_ADDRESS = "v7-debug.main.pools.iexec.eth";
const APP_ADDRESS = "secretadmirer.users.iexec.eth"

const secret1Button = document.getElementById("secret1_button");
const secret2Button = document.getElementById("secret2_button");
const launchButton = document.getElementById("launch_button");
const walletButton = document.getElementById("wallet_button");
const secret1Input = document.getElementById("secret1_input");
const secret2Input = document.getElementById("secret2_input");
const launcherForm = document.getElementById("launcher_form");
const infobox = document.getElementById("infobox");

var REQUESTER_SECRET_1;
var REQUESTER_SECRET_2;

function create_UUID(){
    var dt = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (dt + Math.random()*16)%16 | 0;
        dt = Math.floor(dt/16);
        return (c=='x' ? r :(r&0x3|0x8)).toString(16);
    });
    return uuid;
}


function enableLaunch(){
    if ((secret1Button.disabled == true) && (secret2Button.disabled == true)){
        launchButton.disabled = false;
        launchButton.classList.remove("opacity-50");
        launchButton.classList.add("shadow-lg shadow-cyan-500/50");
    }
}


const checkStorage = (iexec) => async () => {
    try {
        const isStorageInitialized = await iexec.storage.checkStorageTokenExists(
            await iexec.wallet.getAddress()
        );
        return isStorageInitialized;
    } catch (error) {
        infobox.innerText = error.message;
    }
};

const initStorage = (iexec) => async () => {
    try {
        walletButton.disabled = true;
        const storageToken = await iexec.storage.defaultStorageLogin();
        await iexec.storage.pushStorageToken(storageToken, {
            forceUpdate: true
        });
    } catch (error) {
        infobox.innerText = error;
    } finally {
        walletButton.innerText= await iexec.wallet.getAddress();
        walletButton.classList.remove("hover");
        walletButton.disabled = true;
    }
};


const pushSecret = (iexec, secretName, secretButton, secretInput) => async () => {
    if (secretInput.value  !== ''){
    try {
        secretButton.disabled = true;
        const pushed = await iexec.secrets.pushRequesterSecret(secretName, secretInput.value );
    } catch (error) {
        infobox.innerText = error;
    } finally {
        secretButton.disabled = true;
        secretButton.innerText = "Stored 🛡️"
        secretButton.classList.add("opacity-50");
        secretInput.classList.add("opacity-50");
        secretInput.classList.remove("hover:scale-105");
        secretInput.classList.add("blur-sm");
        secretInput.disabled = true;
        secretButton.classList.remove("hover:scale-105");
        enableLaunch();
    }
    }
};


const launchExecution = (iexec) => async () => {
    try {
        launchButton.classList.add("animate-spin");
        launchButton.innerText = "Sending...";
        const {
            orders
        } = await iexec.orderbook.fetchAppOrderbook(
            APP_ADDRESS, {workerpool: WORKERPOOL_ADDRESS});

        
        const appOrder = orders && orders[0] && orders[0].order;
        if (!appOrder) throw Error(`no apporder found for app ${APP_ADDRESS}`);

        const workerPoolRes = await iexec.orderbook.fetchWorkerpoolOrderbook( {
            workerpool : WORKERPOOL_ADDRESS,
            minTag : 'tee'}
        );
        
        const workerPoolOrders = workerPoolRes.orders;
        const workerpoolOrder =
        workerPoolOrders && workerPoolOrders[0] && workerPoolOrders[0].order;
        if (!workerpoolOrder)
            throw Error(`no workerpoolorder found for the selected options: category ${category}`);
        const userAddress = await iexec.wallet.getAddress();

        
        const requestOrderToSign = await iexec.order.createRequestorder({
            app: APP_ADDRESS,
            requester: userAddress,
            workerpool: WORKERPOOL_ADDRESS,
            volume: 1,
            category: 0,
            tag : 'tee',
            params : {iexec_secrets : {1:REQUESTER_SECRET_1,2:REQUESTER_SECRET_2}}
        });

        const requestOrder = await iexec.order.signRequestorder(requestOrderToSign);

        const res = await iexec.order.matchOrders({
            apporder: appOrder,
            requestorder: requestOrder,
            workerpoolorder: workerpoolOrder
        });
       
        infobox.innerText = 'Sent on deal ' + res.dealid;
    

    } catch (error) {
        infobox.innerText = error;
        launchButton.classList.remove("animate-spin");

    } finally {
       launchButton.disabled = true;
       launchButton.innerText = "Sent";
       launchButton.classList.remove("animate-spin");
       launchButton.classList.add("opacity-50");
    }
};


const init = async () => {
    secret1Button.disabled = true;
    secret2Button.disabled = true;
    walletButton.disabled = true;
    launchButton.disabled = true;
    let ethProvider = window.ethereum;
    const configArgs = { ethProvider: window.ethereum,  chainId : 134};
    const configOptions = { smsURL: 'https://v7.sms.debug-tee-services.bellecour.iex.ec' };
    const iexec = new IExec(configArgs, configOptions);

    await ethProvider.enable();
    const {
        result
    } = await new Promise((resolve, reject) =>
        ethProvider.sendAsync({
                jsonrpc: "2.0",
                method: "net_version",
                params: []
            },
            (err, res) => {
                if (!err) resolve(res);
                reject(Error(`Failed to get network version from provider: ${err}`));
            }
        )
    );
    const networkVersion = result;
    if (parseInt(networkVersion) !== 134) {
        walletButton.innerText = "Switch to Bellecour network"
        walletButton.classList.add("bg-red-700");
        walletButton.classList.add("animate-pulse");
    } else {
        const isStorageInitialized = await checkStorage(iexec)();
        if (!isStorageInitialized)
        {
            walletButton.addEventListener("click", initStorage(iexec));
           
            walletButton.classList.add("bg-yellow-400");
            walletButton.classList.add("animate-pulse");
            walletButton.innerText = "Initialize Storage";
        } else {
            walletButton.innerText= await iexec.wallet.getAddress();
            walletButton.classList.remove("hover:scale-105");
            walletButton.classList.add("bg-green-600");

            launcherForm.classList.remove("opacity-20");
         }


        secret1Button.disabled = false;
        secret2Button.disabled = false;
        walletButton.disabled = false;
        launchButton.disabled = false;
    }

    REQUESTER_SECRET_1 = create_UUID();
    REQUESTER_SECRET_2 = create_UUID();
    secret1Button.addEventListener("click", pushSecret(iexec, REQUESTER_SECRET_1, secret1Button, secret1Input));
    secret2Button.addEventListener("click", pushSecret(iexec, REQUESTER_SECRET_2, secret2Button, secret2Input));
    launchButton.addEventListener("click", launchExecution(iexec));

    ethereum.on('chainChanged', () => {
        document.location.reload()
    })
    ethereum.on('accountsChanged', () => {
        document.location.reload()
    })
};

init();