// ===== Garage Scholars - Shared JavaScript =====

// ===== Mobile Nav =====
function toggleMobileNav() {
    document.getElementById('mobileNav').classList.toggle('open');
}

// Close mobile nav when any link inside it is clicked
document.addEventListener('DOMContentLoaded', function() {
    var mobileNav = document.getElementById('mobileNav');
    if (mobileNav) {
        mobileNav.querySelectorAll('a').forEach(function(link) {
            link.addEventListener('click', function() {
                mobileNav.classList.remove('open');
            });
        });
    }

    // Scroll animations
    var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.fade-up, .fade-in').forEach(function(el) {
        observer.observe(el);
    });

    // Quote modal: close on overlay click
    var quoteModal = document.getElementById('quoteModal');
    if (quoteModal) {
        quoteModal.addEventListener('click', function(e) {
            if (e.target === this) closeQuoteModal();
        });
    }

    // Quote form submission
    var quoteForm = document.getElementById('quoteForm');
    if (quoteForm) {
        quoteForm.addEventListener('submit', handleQuoteSubmit);
    }

    // Garage size: show/hide "other" text field
    var garageSizeSelect = document.getElementById('quote-size');
    if (garageSizeSelect) {
        garageSizeSelect.addEventListener('change', function() {
            var otherInput = document.getElementById('quote-size-other');
            if (otherInput) {
                otherInput.style.display = this.value === 'other' ? 'block' : 'none';
                if (this.value !== 'other') otherInput.value = '';
            }
        });
    }
});

// ===== Quote Modal =====
function openQuoteModal(serviceType, packageType) {
    document.getElementById('quoteModal').classList.add('open');
    document.body.style.overflow = 'hidden';
    if (serviceType) {
        var svc = document.getElementById('quote-service');
        if (svc) svc.value = serviceType;
    }
    if (packageType) {
        var pkg = document.getElementById('quote-package');
        if (pkg) pkg.value = packageType;
    }
}

function closeQuoteModal() {
    document.getElementById('quoteModal').classList.remove('open');
    document.body.style.overflow = 'auto';
    var form = document.getElementById('quoteForm');
    if (form) form.reset();
    var otherInput = document.getElementById('quote-size-other');
    if (otherInput) otherInput.style.display = 'none';
    var msg = document.getElementById('formMessage');
    if (msg) {
        msg.textContent = '';
        msg.className = 'form-message';
        msg.style.display = '';
    }
}

// ===== Image Resize =====
function resizePhoto(file, maxDim, quality) {
    return new Promise(function(resolve, reject) {
        var img = new Image();
        var objectUrl = URL.createObjectURL(file);
        var timeout = setTimeout(function() {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Photo "' + file.name + '" took too long to process. It may be in an unsupported format (e.g. HEIC). Please use JPG or PNG.'));
        }, 15000);
        img.onload = function() {
            clearTimeout(timeout);
            URL.revokeObjectURL(objectUrl);
            var w = img.width, h = img.height;
            if (w > maxDim || h > maxDim) {
                if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
                else { w = Math.round(w * maxDim / h); h = maxDim; }
            }
            var canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            var dataUrl = canvas.toDataURL('image/jpeg', quality);
            resolve(dataUrl.split(',')[1]);
        };
        img.onerror = function() {
            clearTimeout(timeout);
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Could not load "' + file.name + '". Please use JPG or PNG format.'));
        };
        img.src = objectUrl;
    });
}

// ===== Quote Form Submit Handler =====
async function handleQuoteSubmit(e) {
    e.preventDefault();
    var msg = document.getElementById('formMessage');
    var btn = this.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Submitting...';

    try {
        var fd = new FormData(this);
        var data = {
            name: fd.get('name'),
            email: fd.get('email'),
            phone: fd.get('phone'),
            zipcode: fd.get('zipcode'),
            serviceType: fd.get('serviceType'),
            package: fd.get('package'),
            garageSize: (function() {
                var sel = fd.get('garageSizeSelect') || '';
                return sel === 'other' ? (fd.get('garageSizeOther') || 'other') : sel;
            })(),
            description: fd.get('description') || '',
            photoData: []
        };

        var photos = fd.getAll('photos').filter(function(f) { return f.size > 0; });
        if (!photos || photos.length < 3) {
            msg.textContent = 'Please upload at least 3 photos of your garage.';
            msg.className = 'form-message error';
            btn.disabled = false;
            btn.textContent = 'Submit Quote Request';
            return;
        }

        msg.className = 'form-message';
        msg.style.display = 'block';

        for (var j = 0; j < photos.length; j++) {
            msg.textContent = 'Processing photo ' + (j + 1) + ' of ' + photos.length + '...';
            var base64 = await resizePhoto(photos[j], 1200, 0.7);
            data.photoData.push({ base64: base64, filename: photos[j].name, mimeType: 'image/jpeg' });
        }

        msg.textContent = 'Submitting your request...';
        var functions = firebase.functions();
        var submitQuoteRequest = functions.httpsCallable('submitQuoteRequest');

        // Retry once on transient network errors
        try {
            await submitQuoteRequest(data);
        } catch (retryErr) {
            if (retryErr.code === 'functions/internal' || retryErr.code === 'functions/unavailable') {
                msg.textContent = 'Retrying submission...';
                await submitQuoteRequest(data);
            } else {
                throw retryErr;
            }
        }

        msg.textContent = "Thank you! Your quote request has been submitted. We'll contact you within 24 hours.";
        msg.className = 'form-message success';
        setTimeout(function() { closeQuoteModal(); }, 4000);

    } catch (error) {
        console.error('Quote submission error:', error);
        var errMsg = 'There was an error submitting your request. Please try again.';
        if (error.code === 'functions/invalid-argument') {
            errMsg = 'Please fill in all required fields.';
        } else if (error.code === 'functions/internal' || error.code === 'functions/unavailable') {
            errMsg = 'Our server is temporarily unavailable. Please try again in a moment.';
        } else if (error.message && error.message !== 'internal') {
            errMsg = 'Error: ' + error.message;
        }
        msg.textContent = errMsg;
        msg.className = 'form-message error';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Submit Quote Request';
    }
}

// ===== Newsletter =====
function handleNewsletter(e) {
    e.preventDefault();
    var form = e.target;
    var email = form.querySelector('input[type="email"]').value;
    var btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Subscribing...';
    var db = firebase.firestore();
    db.collection('newsletterSubscriptions').add({
        email: email,
        subscribedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function() {
        form.querySelector('input[type="email"]').value = '';
        btn.textContent = 'Subscribed!';
        btn.style.background = 'var(--color-primary-dark)';
        setTimeout(function() { btn.textContent = 'Subscribe'; btn.style.background = ''; btn.disabled = false; }, 3000);
    }).catch(function(err) {
        console.error('Newsletter error:', err);
        btn.textContent = 'Error - Try Again';
        btn.style.background = 'var(--color-error)';
        setTimeout(function() { btn.textContent = 'Subscribe'; btn.style.background = ''; btn.disabled = false; }, 3000);
    });
}

// ===== FAQ Toggle =====
function toggleFaq(btn) {
    var item = btn.closest('.faq-item');
    item.classList.toggle('open');
}
