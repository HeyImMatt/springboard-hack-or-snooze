$(async function () {
  // cache some selectors we'll be using quite a bit
  const $allStoriesList = $('#all-articles-list');
  const $submitForm = $('#submit-form');
  const $navSubmit = $('#nav-submit');
  const $filteredArticles = $('#filtered-articles');
  const $loginForm = $('#login-form');
  const $createAccountForm = $('#create-account-form');
  const $ownStories = $('#my-articles');
  const $favoritedArticles = $('#favorited-articles');
  const $navLogin = $('#nav-login');
  const $navLogOut = $('#nav-logout');
  const $navUserProfile = $('#nav-user-profile');
  const $userProfileInfo = $('#user-profile');
  const $navBar = $('.main-nav-links');
  const $navAll = $('#nav-all');

  // global storyList variable
  let storyList = null;

  // global currentUser variable
  let currentUser = null;

  // Click Listeners //

  $navLogin.on('click', toggleLoginCreateAccountForm);
  $navLogOut.on('click', dumpStorageAndReloadPage);
  $navAll.on('click', showMainPage);
  $navBar.on('click', showFavoritesOrMyStories);
  $navUserProfile.on('click', showUserProfileInfo);
  $navSubmit.on('click', () => {
    $submitForm.toggle();
  });

  await checkIfLoggedIn();

  // Form Submit Handlers //
  
  /**
   * Event listener for logging in.
   *  If successful we will setup the user instance
   */
  $loginForm.on('submit', async function (evt) {
    evt.preventDefault(); // no page-refresh on submit

    // grab the username and password
    const username = $('#login-username').val().trim();
    const password = $('#login-password').val().trim();

    // call the login static method to build a user instance
    const userInstance = await User.login(username, password);
    // set the global user to the user instance
    currentUser = userInstance;
    syncCurrentUserToLocalStorage();
    loginAndSubmitForm();
  });

  /**
   * Event listener for signing up.
   *  If successfully we will setup a new user instance
   */
  $createAccountForm.on('submit', async function (evt) {
    evt.preventDefault(); // no page refresh

    // grab the required fields
    let name = $('#create-account-name').val().trim();
    let username = $('#create-account-username').val().trim();
    let password = $('#create-account-password').val().trim();

    // call the create method, which calls the API and then builds a new user instance
    const newUser = await User.create(username, password, name);
    currentUser = newUser;
    syncCurrentUserToLocalStorage();
    loginAndSubmitForm();
  });

  //Article submit form action
  $submitForm.on('submit', async function (evt) {
    evt.preventDefault();

    let storyData = {
      author: $('#author').val().trim(),
      title: $('#title').val().trim(),
      url: $('#url').val().trim(),
    };

    if (currentUser) {
      let addedStory = new Story(
        await storyList.addStory(currentUser, storyData),
      );
      $allStoriesList.prepend(generateStoryHTML(addedStory));
      $('.star').on('click', { event }, favoriteStory);
      $('#author').val('');
      $('#title').val('');
      $('#url').val('');
      $('#submit-form').toggle();
      $('#nav-all').trigger('click');
    }
  });

  async function showFavoritesOrMyStories() {
    let clickId = event.target.id;

    if (clickId === 'nav-favorites' || clickId === 'nav-my-stories') {
      hideElements();
      // Triggering the logged in function to ensure we get the most up to date collections
      await checkIfLoggedIn();

      if (clickId === 'nav-favorites') {
        generateStories($favoritedArticles);
        $favoritedArticles.show();
      } else {
        generateStories($ownStories);
        renderDeleteIcons()
        $ownStories.show();
      }
    }
  }

  async function showMainPage() {
    hideElements();
    await checkIfLoggedIn();
    await generateStories();
    $allStoriesList.show();
  }

  /**
   * On page load, checks local storage to see if the user is already logged in.
   * Renders page information accordingly.
   */
  async function checkIfLoggedIn() {
    // let's see if we're logged in
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');

    // if there is a token in localStorage, call User.getLoggedInUser
    //  to get an instance of User with the right details
    //  this is designed to run once, on page load
    currentUser = await User.getLoggedInUser(token, username);
    await generateStories();

    if (currentUser) {
      showNavForLoggedInUser();
    }
  }

  /**
   * A rendering function to run to reset the forms and hide the login info
   */
  function loginAndSubmitForm() {
    // hide the forms for logging in and signing up
    $loginForm.hide();
    $createAccountForm.hide();

    // reset those forms
    $loginForm.trigger('reset');
    $createAccountForm.trigger('reset');

    // regenerate stories to add favoriting ability
    generateStories();

    // show the stories
    $allStoriesList.show();

    // update the navigation bar
    showNavForLoggedInUser();
  }

  //Favorite stories handler
  async function favoriteStory(evt) {
    let storyId = evt.target.parentElement.parentElement.id;
    if (evt.target.classList.contains('far')) {
      await currentUser.favoriteStory('add', storyId);
      evt.target.className = 'fa-star fa';
    } else {
      await currentUser.favoriteStory('remove', storyId);
      evt.target.className = 'fa-star far';
    }
  }


  // Rendering functions // 

  /**
   * A rendering function to call the StoryList.getStories static method,
   *  which will generate a storyListInstance. Then render it.
   */
  async function generateStories(displayList) {
    // if the function call comes from the favorites link, generate the list of favorites
    if (displayList === $favoritedArticles) {
      storyList.stories = currentUser.favorites;
      displayList.empty();
    } else if (displayList === $ownStories) {
      storyList.stories = currentUser.ownStories;
      displayList.empty();
    } else {
      // get an instance of StoryList
      const storyListInstance = await StoryList.getStories();
      // update our global variable
      storyList = storyListInstance;
      // empty out that part of the page
      $allStoriesList.empty();
    }

    // loop through all of our stories and generate HTML for them
    for (let story of storyList.stories) {
      const result = generateStoryHTML(story);
      displayList ? displayList.append(result) : $allStoriesList.append(result);
    }
    $('.star').on('click', { event }, favoriteStory);
  }

  /**
   * A function to render HTML for an individual Story instance
   */
  function generateStoryHTML(story) {
    let hostName = getHostName(story.url);

    // render story markup
    const storyMarkup = $(`
      <li id="${story.storyId}">
        ${currentUser ?
          `<span class="star">
          <i class="fa-star ${currentUser.favorites.map((story) => story.storyId)
            .includes(story.storyId) ? 'fa' : 'far'}"></i>
          </span>`
          : ''
        }
        <a class="article-link" href="${story.url}" target="a_blank">
          <strong>${story.title}</strong>
        </a>
        <small class="article-author">by ${story.author}</small>
        <small class="article-hostname ${hostName}">(${hostName})</small>
        <small class="article-username">posted by ${story.username}</small>
      </li>
    `);

    return storyMarkup;
  }

  function renderDeleteIcons() {
    const trashIcon = $(`
      <i class="fas fa-trash-alt"></i>
    `)

    trashIcon.on('click', {event}, () => {
      if (confirm('Are you sure you want to delete story?')) {
        currentUser.deleteStory(event.target.parentElement.id);
        $(event.target.parentElement).remove();
      }
    })

    $('#my-articles > li').prepend(trashIcon)
  }

  //UI Helper Functions //

  /* hide all elements in elementsArr */
  function hideElements() {
    const elementsArr = [
      $submitForm,
      $allStoriesList,
      $favoritedArticles,
      $filteredArticles,
      $ownStories,
      $loginForm,
      $createAccountForm,
      $userProfileInfo,
    ];
    elementsArr.forEach(($elem) => $elem.hide());
  }

  function showNavForLoggedInUser() {
    $navLogin.hide();
    $navLogOut.show();
    $('#nav-user-profile').text(currentUser.username);
    $('#nav-welcome').show();
    $('.main-nav-links').show();
  }

  function showUserProfileInfo() {
    $userProfileInfo.toggleClass('container hidden');
    $('#profile-name').text(`Name: ${currentUser.name}`);
    $('#profile-username').text(`Username: ${currentUser.username}`);
    $('#profile-account-date').text(
      `Account Created: ${formatDate(currentUser.createdAt)}`,
    );
  }

  // Show the Login and Create Account Forms
  function toggleLoginCreateAccountForm() {
    $loginForm.slideToggle();
    $createAccountForm.slideToggle();
    $allStoriesList.toggle();
  }


  // Utility Helper Functions //

  function getHostName(url) {
    let hostName;
    if (url.indexOf('://') > -1) {
      hostName = url.split('/')[2];
    } else {
      hostName = url.split('/')[0];
    }
    if (hostName.slice(0, 4) === 'www.') {
      hostName = hostName.slice(4);
    }
    return hostName;
  }

  function syncCurrentUserToLocalStorage() {
    if (currentUser) {
      localStorage.setItem('token', currentUser.loginToken);
      localStorage.setItem('username', currentUser.username);
    }
  }
  
  function dumpStorageAndReloadPage() {
    localStorage.clear();
    location.reload();
  }
  
  function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  }
  
});