export type Language = 'pt' | 'en';

export const translations = {
  // ===== Auth =====
  'auth.welcome': { pt: 'Bem-vindo ao', en: 'Welcome to' },
  'auth.slogan': { pt: 'Share, Build, Share', en: 'Share, Build, Share' },
  'auth.subtitle': { pt: 'Música livre para todos', en: 'Free music for everyone' },
  'auth.email': { pt: 'E-mail', en: 'Email' },
  'auth.password': { pt: 'Senha', en: 'Password' },
  'auth.login': { pt: 'Entrar', en: 'Sign In' },
  'auth.loginWithGoogle': { pt: 'Entrar com Google', en: 'Sign in with Google' },
  'auth.noAccount': { pt: 'Não tem conta?', en: "Don't have an account?" },
  'auth.register': { pt: 'Cadastre-se', en: 'Sign Up' },
  'auth.registerTitle': { pt: 'Criar Conta', en: 'Create Account' },
  'auth.name': { pt: 'Nome', en: 'Name' },
  'auth.confirmPassword': { pt: 'Confirmar Senha', en: 'Confirm Password' },
  'auth.createAccount': { pt: 'Criar Conta', en: 'Create Account' },
  'auth.hasAccount': { pt: 'Já tem conta?', en: 'Already have an account?' },
  'auth.backToLogin': { pt: 'Fazer login', en: 'Sign in' },
  'auth.passwordMismatch': { pt: 'As senhas não coincidem.', en: 'Passwords do not match.' },
  'auth.accountCreated': { pt: 'Conta criada!', en: 'Account created!' },
  'auth.welcomeUser': { pt: 'Bem-vindo ao Spotfly', en: 'Welcome to Spotfly' },

  // ===== Home =====
  'home.goodMorning': { pt: 'Bom dia', en: 'Good morning' },
  'home.goodAfternoon': { pt: 'Boa tarde', en: 'Good afternoon' },
  'home.goodEvening': { pt: 'Boa noite', en: 'Good evening' },
  'home.all': { pt: 'Tudo', en: 'All' },
  'home.music': { pt: 'Músicas', en: 'Music' },
  'home.playlists': { pt: 'Playlists', en: 'Playlists' },
  'home.madeForYou': { pt: 'Feito para Você', en: 'Made for You' },
  'home.communityCopyleft': { pt: 'Comunidade Copyleft', en: 'Copyleft Community' },
  'home.trending': { pt: 'Em Alta', en: 'Trending' },
  'home.newReleases': { pt: 'Lançamentos', en: 'New Releases' },
  'home.popularArtists': { pt: 'Artistas Populares', en: 'Popular Artists' },
  'home.artist': { pt: 'Artista', en: 'Artist' },
  'home.bannerSlogan': { pt: 'Share, Build, Share', en: 'Share, Build, Share' },
  'home.bannerTitle': { pt: 'Plataforma 100% Copyleft', en: '100% Copyleft Platform' },
  'home.bannerSubtitle': {
    pt: 'Todas as músicas aqui são livres. Ouça, compartilhe, remixe e crie sem restrições. Copyleft significa liberdade: o direito de usar, modificar e redistribuir arte para todos.',
    en: 'All music here is free. Listen, share, remix and create without restrictions. Copyleft means freedom: the right to use, modify and redistribute art for everyone.',
  },
  'home.bannerButton': { pt: 'Contribua com sua música', en: 'Contribute your music' },

  // ===== Upload =====
  'upload.title': { pt: 'Compartilhar Música', en: 'Share Music' },
  'upload.subtitle': { pt: 'Sua música ficará disponível para toda a comunidade', en: 'Your music will be available to the entire community' },
  'upload.selectFile': { pt: 'Selecionar arquivo de áudio', en: 'Select audio file' },
  'upload.formats': { pt: 'MP3, WAV, OGG, FLAC (máx. 50MB)', en: 'MP3, WAV, OGG, FLAC (max 50MB)' },
  'upload.myUploads': { pt: 'Meus Uploads', en: 'My Uploads' },
  'upload.noUploads': { pt: 'Nenhuma música enviada ainda', en: 'No music uploaded yet' },
  'upload.tapToUpload': { pt: 'Toque no botão acima para compartilhar', en: 'Tap the button above to share' },
  'upload.license': { pt: 'Copyleft - Livre para compartilhar', en: 'Copyleft - Free to share' },
  'upload.modalTitle': { pt: 'Detalhes da Música', en: 'Song Details' },
  'upload.trackTitle': { pt: 'Título', en: 'Title' },
  'upload.artistName': { pt: 'Artista', en: 'Artist' },
  'upload.albumName': { pt: 'Álbum', en: 'Album' },
  'upload.genre': { pt: 'Gênero', en: 'Genre' },
  'upload.coverSelected': { pt: 'Capa selecionada', en: 'Cover selected' },
  'upload.addCover': { pt: 'Adicionar capa (opcional)', en: 'Add cover (optional)' },
  'upload.tapToChoose': { pt: 'Toque para escolher uma imagem', en: 'Tap to choose an image' },
  'upload.copyleftNotice': {
    pt: 'Ao enviar, sua música será compartilhada com toda a comunidade sob licença Copyleft.',
    en: 'By submitting, your music will be shared with the entire community under Copyleft license.',
  },
  'upload.cancel': { pt: 'Cancelar', en: 'Cancel' },
  'upload.send': { pt: 'Enviar', en: 'Submit' },
  'upload.success': { pt: 'Música Compartilhada!', en: 'Music Shared!' },
  'upload.successMessage': {
    pt: 'agora está disponível para toda a comunidade Spotfly!\n\nShare, Build, Share',
    en: 'is now available to the entire Spotfly community!\n\nShare, Build, Share',
  },
  'upload.error': { pt: 'Erro', en: 'Error' },
  'upload.fillFields': { pt: 'Preencha pelo menos o título e artista.', en: 'Fill in at least the title and artist.' },

  // ===== Search =====
  'search.title': { pt: 'Buscar', en: 'Search' },
  'search.placeholder': { pt: 'O que você quer ouvir?', en: 'What do you want to listen to?' },
  'search.browseAll': { pt: 'Navegar por categorias', en: 'Browse categories' },

  // ===== Library =====
  'library.title': { pt: 'Sua Biblioteca', en: 'Your Library' },
  'library.playlists': { pt: 'Playlists', en: 'Playlists' },
  'library.artists': { pt: 'Artistas', en: 'Artists' },
  'library.albums': { pt: 'Álbuns', en: 'Albums' },
  'library.liked': { pt: 'Músicas Curtidas', en: 'Liked Songs' },

  // ===== Profile / Settings =====
  'profile.title': { pt: 'Perfil', en: 'Profile' },
  'profile.language': { pt: 'Idioma', en: 'Language' },
  'profile.portuguese': { pt: 'Português', en: 'Portuguese' },
  'profile.english': { pt: 'English', en: 'English' },
  'profile.logout': { pt: 'Sair', en: 'Sign Out' },
  'profile.about': { pt: 'Sobre o Spotfly', en: 'About Spotfly' },
  'profile.aboutText': {
    pt: 'Spotfly é uma plataforma de streaming de música copyleft. Toda música aqui é livre para ouvir, compartilhar, remixar e redistribuir.',
    en: 'Spotfly is a copyleft music streaming platform. All music here is free to listen, share, remix and redistribute.',
  },

  // ===== Library extras =====
  'library.myAlbums': { pt: 'Meus Álbuns', en: 'My Albums' },
  'library.tracks': { pt: 'faixas', en: 'tracks' },

  // ===== Tabs =====
  'tab.home': { pt: 'Início', en: 'Home' },
  'tab.search': { pt: 'Buscar', en: 'Search' },
  'tab.library': { pt: 'Biblioteca', en: 'Library' },
  'tab.profile': { pt: 'Perfil', en: 'Profile' },
  // ===== Artist =====
  'artist.albums': { pt: 'Álbuns', en: 'Albums' },
  'artist.tracks': { pt: 'Todas as Faixas', en: 'All Tracks' },
  'artist.songs': { pt: 'músicas', en: 'songs' },

  // ===== Album CRUD =====
  'album.editTitle': { pt: 'Editar Álbum', en: 'Edit Album' },
  'album.albumName': { pt: 'Nome do Álbum', en: 'Album Name' },
  'album.genre': { pt: 'Gênero', en: 'Genre' },
  'album.save': { pt: 'Salvar', en: 'Save' },
  'album.cancel': { pt: 'Cancelar', en: 'Cancel' },
  'album.delete': { pt: 'Excluir Álbum', en: 'Delete Album' },
  'album.deleteConfirm': { pt: 'Tem certeza que deseja excluir este álbum e todas as suas músicas?', en: 'Are you sure you want to delete this album and all its tracks?' },
  'album.changeCover': { pt: 'Alterar Capa', en: 'Change Cover' },

  // ===== Offline Sync =====
  'album.syncStart': { pt: 'Sincronizando álbum...', en: 'Syncing album...' },
  'album.syncComplete': { pt: 'Álbum sincronizado!', en: 'Album synced!' },
  'album.syncRemove': { pt: 'Remover sincronização?', en: 'Remove sync?' },
  'album.synced': { pt: 'Sincronizado', en: 'Synced' },
  'album.syncProgress': { pt: 'Baixando', en: 'Downloading' },
} as const;

export type TranslationKey = keyof typeof translations;
