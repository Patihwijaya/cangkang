// === CANGKANG UI COMPONENTS (REUSABLE) ===

// 1. Komponen Navbar Universal
function renderNavbar(currentRole = '') {
    const user = JSON.parse(localStorage.getItem('cangkang_user'));
    let authSection = '';

    if (user) {
        let dashboardLink = '#';
        if (user.role === 'admin') dashboardLink = 'dashboard-admin.html';
        else if (user.role === 'penyewa') dashboardLink = 'dashboard-penyewa.html';

        authSection = `
            <a href="${dashboardLink}" class="text-sm font-semibold text-gray-700 hover:text-blue-600 mr-4">Dashboard</a>
            <span class="text-sm font-medium text-blue-600 mr-4 hidden sm:inline">Hi, ${user.nama}</span>
            <button onclick="globalLogout()" class="text-sm text-red-500 font-semibold hover:underline">Keluar</button>
        `;
    } else {
        authSection = `
            <a href="login.html" class="text-sm font-semibold text-gray-700 hover:text-blue-600 mr-4">Masuk</a>
            <a href="register.html" class="bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-blue-700 transition">Daftar</a>
        `;
    }

    return `
        <nav class="bg-white/90 backdrop-blur-md shadow-sm border-b px-6 py-4 flex justify-between items-center sticky top-0 z-50">
            <a href="index.html" class="text-2xl font-extrabold text-blue-600 tracking-tight">Cangkang<span class="text-amber-500">.</span></a>
            <div class="flex items-center">
                ${authSection}
            </div>
        </nav>
    `;
}

// 2. Komponen Footer Universal
function renderFooter() {
    return `
        <footer class="bg-white border-t border-gray-200 py-6 text-center mt-auto">
            <p class="text-gray-400 text-sm">© 2026 Cangkang System. All rights reserved.</p>
        </footer>
    `;
}

// 3. Komponen Kartu Properti (Card Gedung) untuk Pencarian / Landing Page
function renderGedungCard(gedung, isRadiusMode = false) {
    const fotoUrl = gedung.foto_utama ? `http://localhost:5000/uploads/${gedung.foto_utama}` : 'https://via.placeholder.com/400x200?text=Tanpa+Foto';
    const isPenuh = gedung.sisa_kamar == 0;
    
    let infoTambahan = "";
    if (isRadiusMode && gedung.jarak_km !== undefined) {
        const jarakFormat = gedung.jarak_km < 1 ? `${(gedung.jarak_km * 1000).toFixed(0)} meter` : `${gedung.jarak_km.toFixed(1)} km`;
        infoTambahan = `<p class="text-sm text-slate-500 mb-2 flex items-center">📍 Berjarak ${jarakFormat}</p>`;
    } else {
        infoTambahan = `<p class="text-sm text-slate-500 mb-2 line-clamp-1">📍 ${gedung.alamat}</p>`;
    }

    return `
        <div class="bg-white rounded-2xl overflow-hidden shadow-sm border hover:shadow-md transition flex flex-col cursor-pointer" onclick="window.location.href='detail.html?id=${gedung.id}'">
            <div class="h-48 bg-slate-200 relative">
                <img src="${fotoUrl}" alt="Foto" class="w-full h-full object-cover">
                <span class="absolute top-3 left-3 px-3 py-1 text-xs font-bold rounded-full ${isPenuh ? 'bg-red-100 text-red-600' : 'bg-white text-blue-600 shadow-sm'}">
                    ${isPenuh ? 'Kamar Penuh' : `Sisa ${gedung.sisa_kamar} Kamar`}
                </span>
            </div>
            <div class="p-5 flex-1 flex flex-col">
                <h3 class="font-bold text-lg leading-tight line-clamp-1 mb-2">${gedung.nama_gedung}</h3>
                ${infoTambahan}
                <div class="mt-auto pt-4 border-t flex justify-between items-center">
                    <p class="font-bold text-lg text-blue-600">Rp ${gedung.harga.toLocaleString('id-ID')}<span class="text-xs font-normal text-slate-500">/${gedung.tipe_sewa}</span></p>
                    <span class="text-xs font-semibold bg-gray-100 px-2 py-1 rounded uppercase">${gedung.kategori}</span>
                </div>
            </div>
        </div>
    `;
}

// Global Logout Handler
function globalLogout() {
    localStorage.removeItem('cangkang_user');
    window.location.href = 'login.html';
}