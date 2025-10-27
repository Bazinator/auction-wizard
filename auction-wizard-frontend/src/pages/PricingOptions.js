import React from 'react';
import './PricingOptions.css';

const PricingOptions = () => {
  return (
    <div>
      <div class="sect sect--padding-bottom">
        <div class="container">
          <div class="row row--center">
            <h1 class="row__title">Pricing</h1>
            <h2 class="row__sub">What fits your business the best?</h2>
          </div>
          <div class="row row--center row--margin">
            <div class="col-md-4 col-sm-4 price-box price-box--purple">
              <div class="price-box__wrap">
                <div class="price-box__img"></div>
                <h1 class="price-box__title">Basic</h1>
                <p class="price-box__people">Limited to max 500 people</p>
                <h2 class="price-box__discount">
                  <span class="price-box__dollar">$</span>9
                  <span class="price-box__discount--light">/mo</span>
                </h2>
                <h3 class="price-box__price">$20/mo</h3>
                <p class="price-box__feat">Features</p>
                <ul class="price-box__list">
                  <li class="price-box__list-el">Access to Bot</li>
                  <li class="price-box__list-el">24h helpcenter</li>
                  <li class="price-box__list-el">No tasks limit</li>
                  <li class="price-box__list-el">No contractors limit </li>
                </ul>
                <div class="price-box__btn">
                  <a class="btn btn--purple btn--width">Start now</a>
                </div>
              </div>
            </div>

            <div class="col-md-4 col-sm-4 price-box price-box--violet">
              <div class="price-box__wrap">
                <div class="price-box__img"></div>
                <h1 class="price-box__title">Premium</h1>
                <p class="price-box__people">Limited to max 100 people</p>
                <h2 class="price-box__discount">
                  <span class="price-box__dollar">$</span>25
                  <span class="price-box__discount--light">/mo</span>
                </h2>
                <h3 class="price-box__price">$40/mo</h3>
                <p class="price-box__feat">Features</p>
                <ul class="price-box__list">
                  <li class="price-box__list-el">1 License</li>
                  <li class="price-box__list-el">24h helpcenter</li>
                  <li class="price-box__list-el">No tasks limit</li>
                  <li class="price-box__list-el">No contractors limit </li>
                </ul>
                <div class="price-box__btn">
                  <a class="btn btn--violet btn--width">Start now</a>
                </div>
              </div>
            </div>

            <div class="col-md-4 col-sm-4 price-box price-box--blue">
              <div class="price-box__wrap">
                <div class="price-box__img"></div>
                <h1 class="price-box__title">Vip</h1>
                <p class="price-box__people">Limited to max 20 people</p>
                <h2 class="price-box__discount">
                  <span class="price-box__dollar">$</span>100
                  <span class="price-box__discount--light">/mo</span>
                </h2>
                <h3 class="price-box__price">$150/mo</h3>
                <p class="price-box__feat">Features</p>
                <ul class="price-box__list">
                  <li class="price-box__list-el">1 License</li>
                  <li class="price-box__list-el">24h helpcenter</li>
                  <li class="price-box__list-el">No tasks limit</li>
                  <li class="price-box__list-el">No contractors limit </li>
                </ul>
                <div class="price-box__btn">
                  <a class="btn btn--blue btn--width">Start now</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default PricingOptions;
