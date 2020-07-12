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

  // global storyList variable
  let storyList = null;

  // global currentUser variable
  let currentUser = null;

  await checkIfLoggedIn();

  /**
   * Event listener for logging in.
   *  If successfully we will setup the user instance
   */

  $loginForm.on('submit', async function (evt) {
    evt.preventDefault(); // no page-refresh on submit

    // grab the username and password
    const username = $('#login-username').val();
    const password = $('#login-password').val();

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
    let name = $('#create-account-name').val();
    let username = $('#create-account-username').val();
    let password = $('#create-account-password').val();

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
      author: $('#author').val(),
      title: $('#title').val(),
      url: $('#url').val(),
    };

    if (currentUser) {
      let addedStory = new Story(
        await storyList.addStory(currentUser, storyData),
      );
      $allStoriesList.prepend(generateStoryHTML(addedStory));
      $('#submit-form').toggle();
    }
  });

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

  /**
   * Log Out Functionality
   */
  $navLogOut.on('click', function () {
    // empty out local storage
    localStorage.clear();
    // refresh the page, clearing memory
    location.reload();
  });

  /**
   * Event Handler for Clicking Login
   */
  $navLogin.on('click', function () {
    // Show the Login and Create Account Forms
    $loginForm.slideToggle();
    $createAccountForm.slideToggle();
    $allStoriesList.toggle();
  });

  //Show user profile info
  $navUserProfile.on('click', () => {
    $userProfileInfo.toggleClass('container hidden');
    $('#profile-name').text(`Name: ${currentUser.name}`);
    $('#profile-username').text(`Username: ${currentUser.username}`);
    $('#profile-account-date').text(
      `Account Created: ${formatDate(currentUser.createdAt)}`,
    );
  });

  // Click listener for clicking Submit (story) navlink
  $navSubmit.on('click', () => {
    $submitForm.toggle();
  });

  // Click listener for favorites and my stories links in nav
  $navBar.on('click', { event }, async function () {
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
  });

  /**
   * Event handler for Navigation to Homepage
   */
  $('body').on('click', '#nav-all', async function () {
    hideElements();
    await checkIfLoggedIn();
    await generateStories();
    $allStoriesList.show();
  });

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
    // add click listener for favoriting stories
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
      console.log(event)
    })

    $('#my-articles > li').prepend(trashIcon)
  }

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

  /* simple function to pull the hostname from a URL */

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

  /* sync current user information to localStorage */

  function syncCurrentUserToLocalStorage() {
    if (currentUser) {
      localStorage.setItem('token', currentUser.loginToken);
      localStorage.setItem('username', currentUser.username);
    }
  }
});

//Date formatter function
function formatDate(dateString) {
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return new Date(dateString).toLocaleDateString(undefined, options);
}
