// ==========================
// SETTINGS PAGE.
// ==========================
// db and currentAgent are initialized by app.js 

function getDB() { 
	return window.db;
 }
function getAgent() {
	return window.currentAgent; 
}

let currentSection = 'company';

// INIT
// WAIT FOR APP.JS INITIALIZATION

document.addEventListener('DOMContentLoaded', async () => {

    try {

        // SAME PATTERN AS FOLLOWUPS PAGE

        await initApp();

        console.log('db:', window.db);
        console.log('agent:', window.currentAgent);

        if (!window.currentAgent) {
            alert('Please login again');
            window.location.href = '/';
            return;
        }

        await loadSettings();

    } catch (err) {

        console.error('Init Error:', err);

    }

});



// HOME

function goHome() {
    window.location.href = '/portal';
}

// LOGOUT

async function logout() {

    try {

        if (window.db?.auth) {
            await window.db.auth.signOut();
        }

        localStorage.clear();
        sessionStorage.clear();

        window.location.href = '/';

    } catch (err) {
        console.error(err);
        alert('Logout failed');
    }
}



// SECTION SWITCH

function showSection(section, btn){

    document
        .querySelectorAll('.section')
        .forEach(el => el.classList.remove('active'));

    document
        .querySelectorAll('.nav-item')
        .forEach(el => el.classList.remove('active'));

    document
        .getElementById(section)
        .classList.add('active');

    btn.classList.add('active');

    currentSection = section;
}

// LOAD SETTINGS

async function loadSettings(){

    try{

        const { data } = await getDB()
            .from('settings')
            .select('*')
            //.eq('agent_id', currentAgent.id)
            .eq('agent_id', getAgent().id)
            .maybeSingle();

        if(!data) return;
		
// LOAD PROFILE PICTURE

		console.log('Profile URL:', data.profile_picture_url);

		if(data.profile_picture_url){

    		document.getElementById('profile-preview').innerHTML = `
        		<img
            		src="${data.profile_picture_url}"
            		style="
                		width:100%;
                		height:100%;
                		object-fit:cover;
                		border-radius:50%;
            		"
        		/>
   		 `;
		}
		else{

   		 const name =
       		 getAgent().name || 'User';

    		const initials =
       		 name
        		.split(' ')
        		.map(word => word[0])
        		.join('')
        		.substring(0,2)
        		.toUpperCase();

    		document.getElementById('profile-preview')
       		 .textContent = initials;
		}

        document.getElementById('company-name').value =
            data.company_name || '';

        document.getElementById('owner-name').value =
            data.owner_name || '';

        document.getElementById('company-email').value =
            data.email || '';

        document.getElementById('company-mobile').value =
            data.mobile || '';

        document.getElementById('company-address').value =
            data.address || '';

        document.getElementById('gst-number').value =
            data.gst_number || '';

        document.getElementById('rera-number').value =
            data.rera_number || '';

        document.getElementById('gst-percent').value =
            data.gst_percent || 5;

        document.getElementById('stamp-duty').value =
            data.stamp_duty_percent || 6;

        document.getElementById('registration').value =
            data.registration_percent || 1;

        document.getElementById('brokerage').value =
            data.brokerage_percent || 2;

        document.getElementById('tds').value =
            data.tds_percent || 1;

        document.getElementById('email-notification').checked =
            data.email_notifications || false;

        document.getElementById('whatsapp-notification').checked =
            data.whatsapp_notifications || false;

        document.getElementById('lead-alerts').checked =
            data.lead_alerts || false;

        document.getElementById('system-updates').checked =
            data.system_updates || false;

    }
    catch(err){
        console.error(err);
    }
}

//Create upload function

async function uploadProfilePicture() {

    const file =
        document.getElementById('profile-picture')
        .files[0];

    if (!file) return null;

    const agentId = getAgent().id;

    // GET CURRENT IMAGE URL

    const { data: current } = await getDB()
        .from('settings')
        .select('profile_picture_url')
        .eq('agent_id', agentId)
        .maybeSingle();


    // UPLOAD NEW IMAGE
		const fileName = `${agentId}.jpg`;

		const { error } = await getDB()
    		.storage
    		.from('profile-pictures')
    		.upload(fileName, file, {
        		upsert: true
    });

    if (error) throw error;

    const { data } = getDB()
        .storage
        .from('profile-pictures')
        .getPublicUrl(fileName);

    return data.publicUrl;
}


// SAVE

async function saveAllSettings(){

    try{
		let profilePictureUrl = null; 
		if ( document.getElementById('profile-picture') 
     		.files.length > 0
 		)
 		{ profilePictureUrl = 
			await uploadProfilePicture(); }

        const payload = {

            agent_id: getAgent().id,

            company_name:
                document.getElementById('company-name').value,

            owner_name:
                document.getElementById('owner-name').value,
			
			email:
                document.getElementById('company-email').value,

            mobile:
                document.getElementById('company-mobile').value,

            address:
                document.getElementById('company-address').value,

            gst_number:
                document.getElementById('gst-number').value,

            rera_number:
                document.getElementById('rera-number').value,

            gst_percent:
                Number(document.getElementById('gst-percent').value),

            stamp_duty_percent:
                Number(document.getElementById('stamp-duty').value),

            registration_percent:
                Number(document.getElementById('registration').value),

            brokerage_percent:
                Number(document.getElementById('brokerage').value),

            tds_percent:
                Number(document.getElementById('tds').value),

            email_notifications:
                document.getElementById('email-notification').checked,

            whatsapp_notifications:
                document.getElementById('whatsapp-notification').checked,

            lead_alerts:
                document.getElementById('lead-alerts').checked,

            system_updates:
                document.getElementById('system-updates').checked,

            updated_at:
                new Date().toISOString()
        };
		if(profilePictureUrl){
    	payload.profile_picture_url = profilePictureUrl;
		}

        //const { error } = await db
        const { error } = await getDB()
    .		from('settings')
    		.upsert(payload, {
        	onConflict: 'agent_id'
    });

        if(error) throw error;

        alert('✅ Settings Saved Successfully');

    }
    catch(err){

        alert(err.message);

    }
}

// ==========================
// PROFILE IMAGE PREVIEW
// ==========================

document.getElementById('profile-picture')
?.addEventListener('change', function(e){

    const file = e.target.files[0];

    if(!file) return;

    const reader = new FileReader();

    reader.onload = function(event){

        document.getElementById('profile-preview').innerHTML = `
            <img
                src="${event.target.result}"
                style="
                    width:100%;
                    height:100%;
                    object-fit:cover;
                    border-radius:50%;
                "
            >
        `;
    };

    reader.readAsDataURL(file);

});


